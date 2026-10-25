# Canonical exercise catalog; external sources are ingestion-only

External exercise catalogs (wger mirror, licensed datasets) are one-off ingestion sources:
importer scripts transform their data into physlane's canonical exercise model — our IDs, our
muscle-group taxonomy, our equipment tags. The app's schema, identifiers, and categories are
never shaped after a source API, and no source API is a runtime dependency. Decided during the
shareable-programs design: data sources may differ and change over time, while program rows
must reference forever-stable physlane-owned exercise IDs.

## Consequences

- Re-syncing from a source is a heuristic merge we own (match on name/muscle/equipment); our
  IDs are never overwritten by source IDs.
- Runtime proxying of any catalog API is out; the catalog ships as our data in D1.
- A source's license (software license ≠ data license) must be verified before each import.
