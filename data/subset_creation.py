"""Filters the Cincinnati 311 dataset to visible urban disorder service types and normalizes category labels."""

import pandas as pd  # ty:ignore[unresolved-import]
from pathlib import Path

BASE_DATA = Path("data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv")
SUBSET_PATH = Path("data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227_subset.csv")

# graffiti — public property, highway/ROW, parks, private property
GRAFFITI = ["GRFITI", "GRFITI-H", "GRAFPARK", "GRFTRPRV"]

# vacant properties
VACANCY = ["VACANT"]

# illegal dumping on private surface
DUMPING = ["DUMP-PVS"]

# littering
LITTERING = ["LTTR-BLD", "LTTR-CDV", "LTTR-PRK", "LTTR-REC", "LTTRRST"]

# trash — exterior, interior, large item, recyclables
TRASH = ["TRASH-E", "TRASH-I", "TRASH-L", "TRASH-RE"]

# tires
TIRES = ["TIRES"]

# full set of SR_TYPEs to include in the subset
URBAN_DISORDER = GRAFFITI + VACANCY + DUMPING + LITTERING + TRASH + TIRES

df = pd.read_csv(BASE_DATA, low_memory=False)
subset_df = df[df["SR_TYPE"].isin(URBAN_DISORDER)].copy()

# normalize into single labels per category (and renaming for clarity)
subset_df.loc[subset_df["SR_TYPE"].isin(GRAFFITI), "SR_TYPE"] = "GRAFFITI"
subset_df.loc[subset_df["SR_TYPE"].isin(DUMPING), "SR_TYPE"] = "DUMPING"
subset_df.loc[subset_df["SR_TYPE"].isin(LITTERING), "SR_TYPE"] = "LITTERING"
subset_df.loc[subset_df["SR_TYPE"].isin(TRASH), "SR_TYPE"] = "TRASH"

# drop rows with no neighborhood
subset_df = subset_df[subset_df["NEIGHBORHOOD"].notna() & (subset_df["NEIGHBORHOOD"].str.strip() != "")]

subset_df.to_csv(SUBSET_PATH, index=False)
