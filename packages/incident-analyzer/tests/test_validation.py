import unittest

from incident_analyzer import Rule, validate_row
from incident_analyzer.validation import parse_score

from .support import make_row


class ValidRowTests(unittest.TestCase):
    def test_valid_row_has_no_violations(self) -> None:
        result = validate_row(make_row())
        self.assertTrue(result.is_valid)
        self.assertEqual(result.violations, frozenset())


class SingleRuleTests(unittest.TestCase):
    def assertOnlyRule(self, rule: Rule, **overrides: str) -> None:
        result = validate_row(make_row(**overrides))
        self.assertFalse(result.is_valid)
        self.assertEqual(result.violations, frozenset({rule}))

    def test_empty_client_company(self) -> None:
        self.assertOnlyRule(Rule.MISSING_CLIENT_COMPANY, client_company="")

    def test_empty_category(self) -> None:
        self.assertOnlyRule(Rule.INVALID_CATEGORY, category="")

    def test_unknown_category(self) -> None:
        self.assertOnlyRule(Rule.INVALID_CATEGORY, category="SHIPPING")

    def test_category_is_case_sensitive(self) -> None:
        self.assertOnlyRule(Rule.INVALID_CATEGORY, category="technical")

    def test_empty_description(self) -> None:
        self.assertOnlyRule(Rule.INVALID_DESCRIPTION, description="")

    def test_description_shorter_than_five_characters(self) -> None:
        self.assertOnlyRule(Rule.INVALID_DESCRIPTION, description="Help")

    def test_description_of_exactly_five_characters_is_valid(self) -> None:
        self.assertTrue(validate_row(make_row(description="Error")).is_valid)

    def test_empty_agent_id(self) -> None:
        self.assertOnlyRule(Rule.INVALID_AGENT_ID, agent_id="")

    def test_malformed_agent_ids(self) -> None:
        for agent_id in ("AGT-7", "AGT-007", "agt-07", "AGT07", "AGT-AB", "AGT-07\n", "AGT-٠٧"):
            with self.subTest(agent_id=agent_id):
                self.assertOnlyRule(Rule.INVALID_AGENT_ID, agent_id=agent_id)

    def test_empty_email(self) -> None:
        self.assertOnlyRule(Rule.INVALID_EMAIL, customer_email="")

    def test_email_without_at_sign(self) -> None:
        self.assertOnlyRule(Rule.INVALID_EMAIL, customer_email="someone.example.invalid")

    def test_email_rule_is_only_the_at_sign(self) -> None:
        # D5: nada de validación RFC; con que contenga "@" basta.
        self.assertTrue(validate_row(make_row(customer_email="a@b")).is_valid)

    def test_closed_without_score(self) -> None:
        self.assertOnlyRule(Rule.CLOSED_WITHOUT_SCORE, status="CLOSED", satisfaction_score="")


class ScoreTests(unittest.TestCase):
    def test_score_zero_is_out_of_range(self) -> None:
        result = validate_row(make_row(status="CLOSED", satisfaction_score="0"))
        self.assertEqual(result.violations, frozenset({Rule.SCORE_OUT_OF_RANGE}))

    def test_score_one_is_valid(self) -> None:
        self.assertTrue(validate_row(make_row(status="CLOSED", satisfaction_score="1")).is_valid)

    def test_score_five_is_valid(self) -> None:
        self.assertTrue(validate_row(make_row(status="CLOSED", satisfaction_score="5")).is_valid)

    def test_score_six_is_out_of_range(self) -> None:
        result = validate_row(make_row(status="CLOSED", satisfaction_score="6"))
        self.assertEqual(result.violations, frozenset({Rule.SCORE_OUT_OF_RANGE}))

    def test_non_integer_scores_are_out_of_range(self) -> None:
        for raw in ("4.5", "4.0", "abc", "-1", "+4", "1_0", "٤"):
            with self.subTest(raw=raw):
                result = validate_row(make_row(status="CLOSED", satisfaction_score=raw))
                # Hay valor, así que no es "CLOSED sin score": es fuera de rango.
                self.assertEqual(result.violations, frozenset({Rule.SCORE_OUT_OF_RANGE}))

    def test_valid_score_on_open_ticket_is_allowed(self) -> None:
        self.assertTrue(validate_row(make_row(status="OPEN", satisfaction_score="3")).is_valid)

    def test_valid_score_on_discarded_ticket_is_allowed(self) -> None:
        self.assertTrue(validate_row(make_row(status="DISCARDED", satisfaction_score="2")).is_valid)

    def test_out_of_range_score_on_open_ticket_is_invalid(self) -> None:
        result = validate_row(make_row(status="OPEN", satisfaction_score="7"))
        self.assertEqual(result.violations, frozenset({Rule.SCORE_OUT_OF_RANGE}))

    def test_parse_score_error_does_not_echo_the_value(self) -> None:
        with self.assertRaises(ValueError) as caught:
            parse_score("secret-value-42")
        self.assertNotIn("secret-value-42", str(caught.exception))


class MultipleRuleTests(unittest.TestCase):
    def test_row_activates_every_matching_rule(self) -> None:
        row = make_row(
            client_company="",
            category="",
            description="Hi",
            agent_id="AGT-1",
            customer_email="",
            status="CLOSED",
            satisfaction_score="9",
        )
        self.assertEqual(
            validate_row(row).violations,
            frozenset(
                {
                    Rule.MISSING_CLIENT_COMPANY,
                    Rule.INVALID_CATEGORY,
                    Rule.INVALID_DESCRIPTION,
                    Rule.INVALID_AGENT_ID,
                    Rule.INVALID_EMAIL,
                    Rule.SCORE_OUT_OF_RANGE,
                }
            ),
        )

    def test_closed_without_score_combines_with_other_rules(self) -> None:
        row = make_row(client_company="", status="CLOSED", satisfaction_score="")
        self.assertEqual(
            validate_row(row).violations,
            frozenset({Rule.MISSING_CLIENT_COMPANY, Rule.CLOSED_WITHOUT_SCORE}),
        )


class OutOfContractFieldsTests(unittest.TestCase):
    """D3: ticket_id, date y status fuera de formato no invalidan la fila."""

    def test_malformed_ticket_id_date_and_status_do_not_invalidate(self) -> None:
        row = make_row(ticket_id="BAD-1", date="13/08/2026", status="PENDING")
        self.assertTrue(validate_row(row).is_valid)

    def test_lowercase_closed_is_not_closed(self) -> None:
        # "closed" no es un status definido: no activa la regla de CLOSED sin score.
        self.assertTrue(validate_row(make_row(status="closed", satisfaction_score="")).is_valid)


if __name__ == "__main__":
    unittest.main()
