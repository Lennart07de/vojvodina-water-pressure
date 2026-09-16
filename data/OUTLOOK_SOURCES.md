# Drought Forecast additions — verified 16 September 2026

The product supports drought monitoring. It does not build a drought or hydrological prediction model. The 1–30-day slider changes the regional ensemble outlook; the map remains explicitly a seven-day weather-pressure indicator.

## Temperature

The existing [Open-Meteo ECMWF API](https://open-meteo.com/en/docs/ecmwf-api) supplies daily mean 2 m air temperature, area-weighted over all samples for district and municipal details. Missing temperature does not invalidate otherwise complete rainfall/ET₀. Temperature already influences provider-calculated ET₀, so it is not double-counted with an extra score weight.

## 1–30-day timeline

[Open-Meteo ensemble API / NOAA GFS](https://open-meteo.com/en/docs/ensemble-api): fixed `gfs05` model, 0.5° (~50 km), 31 members, up to 35 days. Live precipitation and temperature coverage verified for Vojvodina. Request 31 calendar days and exclude today. At each horizon, sum rainfall or average daily mean temperature within each member first, then take the median and 10th/90th percentiles (sorted indices 15, 3, 27). All 31 members must be complete for a variable/horizon. Do not sum daily quantiles. Spread is not a calibrated confidence interval or a guarantee; longer horizons support broad planning only. No 30-day score or restriction recommendation is generated.

## Recent precipitation versus normal

[Open-Meteo historical API / Copernicus ERA5](https://open-meteo.com/en/docs/historical-weather-api): fixed `era5`, 0.25° (~25 km), five-day publication delay. Compare the latest complete common 30-day period ending at least five days before today (search up to seven additional days of publication lag) against the sum of **1991–2020 calendar-day means for the same dates**. February 29 uses eight years. Percent of normal is withheld if the normal is zero or recent rainfall is incomplete. Recent mean temperature uses the same period. This is delayed reanalysis, not today's gauge readings or an official Serbian station normal.

Each district uses one existing interior sample nearest its area-weighted sample centroid. These are **point proxies, not district-area averages**. They must not be presented as municipality values. The recent and historical ERA5 returned coordinates must match. GFS may resolve adjacent districts to the same coarse cell. GFS forecasts are not spliced with ERA5 or compared against the historical baseline as if the models were interchangeable.

Reproduce the committed baseline with `node scripts/prepare-climate.mjs`. It downloads 10,958 daily rainfall values per point, validates units and complete years, and writes `data/climate-normals.json` with source URLs, retrieval date, requested/returned coordinates and SHA-256 hashes of raw responses. Seven points contain complete data. Derived data retain Open-Meteo/Copernicus attribution and [CC BY 4.0 terms](https://open-meteo.com/en/terms). Generation requires network but is not part of build or runtime.

## Reservoir coverage gap

Checked [Vode Vojvodine information](https://www.vodevojvodine.com/osnovni-podaci/), [public bulletins](https://www.vodevojvodine.com/bilteni/) and [RHMZ hydrological monitoring](https://www.hidmet.gov.rs/latin/hidrologija/naslovna_stanje.php). A reliable current reservoir-level/usable-storage feed linked to the seven districts was **not verified**. The interface explicitly marks reservoir levels unavailable for all districts. River gauge heights and discharge are not reservoir storage; no percentages or values are invented. Dated levels, usable capacity and district supply connections from the authority are needed before a water-supply component can be calculated.

## Endpoint and deployment

`GET /api/outlook` uses two bounded multi-location requests for fixed public coordinates, with 45-second timeouts. No API keys, database or new environment variables. Complete results may be cached for six hours; incomplete results five minutes, per warm server instance. Concurrent requests share a refresh. All visible values expire at Belgrade date rollover or after 24 hours. Missing history and ensemble values fail independently. Standard Next.js/Vercel configuration applies; add `/api/outlook` to smoke checks.
