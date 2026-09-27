# Fixtures de test — datos sintéticos

**Ninguno de estos archivos contiene datos reales de Nexova.** Todos son sintéticos: empresas `Synthetic Client …`, descripciones `Synthetic ticket …` o frases inventadas, y emails ficticios del dominio reservado `example.invalid`.

| Archivo | Filas de datos | Para qué |
|---|---|---|
| `incidents-synthetic.csv` | 13 | Casos variados de las reglas (varias reglas en una fila, status fuera de contrato, score en OPEN…). Lo usan los tests unitarios, de privacidad y de CLI del núcleo, los de `services/api` y la documentación de ejemplo |
| `incidents-acceptance-synthetic.csv` | 100 | **Fixture sintético de aceptación**: generado para que el analizador produzca exactamente las cifras de `docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md` (100/96/4, categorías 28/18/21/17/12, estados 27/56/13, satisfacción 2/5/10/22/17 con 56 de 56 puntuados y media 3.84). Las 4 filas inválidas (filas 18, 45, 71 y 93 del CSV) activan una sola regla cada una: `missing_client_company`, `invalid_category`, `invalid_email` y `closed_without_score`. Lo verifica `tests/test_acceptance_synthetic.py` |

El fixture de aceptación **no es** `incidents-nexova.csv` ni lo sustituye: la validación contra el archivo real sigue en `tests/test_acceptance.py`, omitida mientras ese archivo no esté disponible (`data/raw/incidents/`, ignorado por git).
