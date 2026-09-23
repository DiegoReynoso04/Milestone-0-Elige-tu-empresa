"""POST /api/incidents/analyze — casos correctos y contrato del JSON."""

import unittest
import uuid
from datetime import datetime

from incident_analyzer import Category, Rule, Status, analyze_file

from .support import ANALYZE_URL, FIXTURE, csv_bytes, make_client, post_csv


class AnalyzeFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = make_client()
        cls.response = post_csv(cls.client, FIXTURE.read_bytes())
        cls.body = cls.response.json()

    def test_status_and_content_type(self) -> None:
        self.assertEqual(self.response.status_code, 200)
        self.assertEqual(self.response.headers["content-type"], "application/json")

    def test_top_level_keys(self) -> None:
        self.assertEqual(
            set(self.body),
            {"analysis_id", "analyzed_at", "totals", "invalid_breakdown", "categories", "statuses", "satisfaction", "export"},
        )

    def test_metadata(self) -> None:
        uuid.UUID(self.body["analysis_id"])
        self.assertTrue(self.body["analyzed_at"].endswith("Z"))
        datetime.fromisoformat(self.body["analyzed_at"])

    def test_totals(self) -> None:
        self.assertEqual(self.body["totals"], {"total_records": 13, "valid_records": 8, "invalid_records": 5})

    def test_invalid_breakdown_has_seven_rules_in_core_order(self) -> None:
        self.assertEqual([item["code"] for item in self.body["invalid_breakdown"]], [rule.code for rule in Rule])
        self.assertEqual([item["label"] for item in self.body["invalid_breakdown"]], [rule.label for rule in Rule])
        self.assertEqual([item["count"] for item in self.body["invalid_breakdown"]], [2, 1, 1, 1, 2, 1, 1])

    def test_categories_in_core_order_with_decimal_strings(self) -> None:
        self.assertEqual([item["code"] for item in self.body["categories"]], [c.value for c in Category])
        self.assertEqual(
            self.body["categories"][0], {"code": "TECHNICAL", "count": 2, "percentage": "25.0"}
        )
        self.assertEqual(self.body["categories"][2]["percentage"], "12.5")

    def test_statuses_in_core_order(self) -> None:
        self.assertEqual([item["code"] for item in self.body["statuses"]], [s.value for s in Status])
        self.assertEqual([item["count"] for item in self.body["statuses"]], [2, 4, 1])
        self.assertEqual(self.body["statuses"][1]["percentage"], "50.0")

    def test_satisfaction(self) -> None:
        satisfaction = self.body["satisfaction"]
        self.assertEqual(satisfaction["closed_tickets"], 4)
        self.assertEqual(satisfaction["scored_tickets"], 4)
        self.assertEqual(satisfaction["average_score"], "3.75")
        self.assertEqual([item["score"] for item in satisfaction["distribution"]], [1, 2, 3, 4, 5])
        self.assertEqual([item["count"] for item in satisfaction["distribution"]], [0, 1, 0, 2, 1])
        self.assertEqual(satisfaction["distribution"][0]["label"], "Very dissatisfied")

    def test_export_info(self) -> None:
        self.assertEqual(
            self.body["export"],
            {"available": True, "url": "/api/incidents/results/export", "filename": "results.csv", "format": "metric,value"},
        )

    def test_matches_core_result_used_by_cli(self) -> None:
        # Paridad con la CLI: mismo núcleo, mismos números.
        core = analyze_file(FIXTURE)
        self.assertEqual(self.body["totals"]["invalid_records"], core.invalid_records)
        self.assertEqual(
            [item["count"] for item in self.body["invalid_breakdown"]], [item.count for item in core.invalid_breakdown]
        )
        self.assertEqual(
            [item["percentage"] for item in self.body["categories"]], [str(item.percentage) for item in core.categories]
        )
        self.assertEqual(self.body["satisfaction"]["average_score"], str(core.satisfaction.average_score))


class AnalyzeVariantsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = make_client()

    def test_uppercase_extension_is_accepted(self) -> None:
        self.assertEqual(post_csv(self.client, FIXTURE.read_bytes(), filename="INCIDENTS.CSV").status_code, 200)

    def test_mime_type_is_not_used_to_decide(self) -> None:
        response = self.client.post(
            ANALYZE_URL, files={"file": ("incidents.csv", FIXTURE.read_bytes(), "application/vnd.ms-excel")}
        )
        self.assertEqual(response.status_code, 200)

    def test_csv_with_invalid_records(self) -> None:
        body = post_csv(
            self.client,
            csv_bytes(
                "NXV-000001,2026-08-01,Acme,TECHNICAL,Printer broken,AGT-01,OPEN,a@example.invalid,",
                "NXV-000002,2026-08-01,Acme,SHIPPING,Package lost,AGT-02,OPEN,b@example.invalid,",
            ),
        ).json()
        self.assertEqual(body["totals"], {"total_records": 2, "valid_records": 1, "invalid_records": 1})
        self.assertEqual(body["invalid_breakdown"][1], {"code": "invalid_category", "label": "Invalid or missing category", "count": 1})

    def test_multiple_rules_in_one_row_count_once_as_invalid(self) -> None:
        body = post_csv(
            self.client, csv_bytes("NXV-000001,2026-08-01,,HR_QUERY,Hi,AGT-1,CLOSED,,9")
        ).json()
        self.assertEqual(body["totals"]["invalid_records"], 1)
        counts = {item["code"]: item["count"] for item in body["invalid_breakdown"]}
        self.assertEqual(
            counts,
            {
                "missing_client_company": 1,
                "invalid_category": 0,
                "invalid_description": 1,
                "invalid_agent_id": 1,
                "invalid_email": 1,
                "closed_without_score": 0,
                "score_out_of_range": 1,
            },
        )

    def test_header_only_returns_zeros_and_nulls(self) -> None:
        response = post_csv(self.client, csv_bytes())
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["totals"], {"total_records": 0, "valid_records": 0, "invalid_records": 0})
        self.assertTrue(all(item["percentage"] is None for item in body["categories"] + body["statuses"]))
        self.assertIsNone(body["satisfaction"]["average_score"])

    def test_each_analysis_gets_a_new_id(self) -> None:
        first = post_csv(self.client, FIXTURE.read_bytes()).json()["analysis_id"]
        second = post_csv(self.client, FIXTURE.read_bytes()).json()["analysis_id"]
        self.assertNotEqual(first, second)


class HealthTests(unittest.TestCase):
    def test_health(self) -> None:
        response = make_client().get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
