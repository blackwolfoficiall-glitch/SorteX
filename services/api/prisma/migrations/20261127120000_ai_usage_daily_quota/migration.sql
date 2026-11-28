-- Shared, additive quota accounting for the explicit QA advisor pilot.
CREATE TABLE "AiUsageDailyQuota" (
    "day" DATE NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL,
    "inputUnits" INTEGER NOT NULL,
    "outputUnits" INTEGER NOT NULL,

    CONSTRAINT "AiUsageDailyQuota_pkey" PRIMARY KEY ("day","scope","scopeId"),
    CONSTRAINT "AiUsageDailyQuota_scope_check" CHECK (
        ("scope" = 'GLOBAL' AND "scopeId" = 'GLOBAL')
        OR ("scope" = 'ORGANIZER' AND char_length("scopeId") BETWEEN 1 AND 128)
    ),
    CONSTRAINT "AiUsageDailyQuota_units_check" CHECK (
        "requestCount" > 0 AND "inputUnits" > 0 AND "outputUnits" > 0
    )
);
