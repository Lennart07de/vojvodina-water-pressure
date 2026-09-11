# Water Under Pressure — ATELIA × ESCP Starter Kit

> This repo is your starting point. Codex should read this README first.

## How to Get Started

This repo is a **template**: click **Fork** (top right), not "Use this template." Fork keeps your copy linked back to the original — that's what lets ATELIA automatically find every team's work, without anyone needing to send a link.

Once you've forked it, add your teammates as collaborators (Settings → Collaborators on your fork), and leave the visibility as **Public** — don't switch it to Private, or we lose access to your work.

## The Brief

The full brief is in `WATER_Case_Brief.md`. Unlike the other case, there's no single company or fixed decision here — you choose the angle. The list of real, free public data sources you can build on is in `data/PUBLIC_SOURCES.md`.

One-sentence summary: Europe's water stress became a visible economic story in 2026 — droughts, record-low rivers, industrial shutdown risk, and a wave of EU investment. Your job is to pick a real problem inside that story and build a tool that helps someone make a better decision about it, using real public data.

## Rule #1 — Prompt Logging Is Automatic

This repo includes an `AGENTS.md` file, which Codex reads automatically at the start of every task — you don't need to open or edit it. The first time you talk to Codex in a new conversation, it will ask for your **student ID**. Answer it, and from then on Codex logs every prompt you send it — automatically, verbatim — into `prompts/<your-id>/session-*.md`, without you doing anything else.

**You don't fill this in by hand.** Your only job is to make sure that log file gets committed along with your code changes — Codex writes it, but you still need to include it when your pull request is created and merged. If a pull request only has code changes and no updated log file, that's a sign something didn't get logged.

Why we're doing this: it's not to monitor you. It's what lets us understand, at the end, how you reasoned — not just what you produced. A good result reached with a clear prompt from the start isn't scored the same as a good result reached after fifteen random attempts.

## Rule #2 — Before You Code, Ask Yourself These Questions

Check each box in this README as you go — not at the end, while you're working:

- [x] **Data**: what data does your tool actually pull, and from where? If you're using a live public API, is any of it rate-limited or does it require an API key?
- [x] **API keys**: if a source requires a free API key (a couple in `data/PUBLIC_SOURCES.md` do), where is it stored? Never hardcoded in a file committed to GitHub. (A valid answer: "we only used sources that don't require a key.")
- [ ] **Deployment**: if you deployed a live demo, does any endpoint expose your API key, or return unfiltered raw data to any visitor?
- [x] **Attribution**: are you using real public data appropriately — no claim that estimated or invented numbers are official figures?
- [x] **Storage**: if you downloaded a snapshot of a dataset instead of calling it live, did you commit it to the repo? If so, is it small enough to be reasonable, and is its source clearly documented?
- [x] **Robustness**: what happens if the user gives an empty, inconsistent, or unexpected input? What happens if the external data source is temporarily down?
- [x] **Explainability**: can you explain to someone non-technical why your tool does what it does, and which real data it's actually built on?
- [x] **Business relevance**: does your prototype solve a real, specific problem for a real kind of user — or is it an interesting technical build with no clear "who is this for"?

These questions aren't here to slow you down — they're part of what's being evaluated. A thoughtful answer to one of them is worth more than an extra feature nobody asked for.

## What We Expect at the End

- A prototype that works, even partially, using at least one real public data source
- Your prompt log (`prompts/<your-id>/session-*.md`) committed and up to date
- A short paragraph below, written in business language (not technical), explaining what you built, for whom, and why
- A live URL (Vercel or similar) if you deployed it — not required to still get credit, but expected if you did

## Our Approach

We built an interactive decision-support map for a regional water-management authority in Vojvodina, Serbia. It compares weather-driven irrigation pressure across seven districts for seven complete future days so the authority can focus monitoring, prepare restriction options, or prioritise water-saving measures. The prototype uses real public forecasts and transparent calculations; it does not predict water availability or authorise restrictions.

## Run the prototype

Requires Node.js 24 and npm. No API keys, database, application accounts or paid services are needed for this educational prototype.

```sh
npm run install:ci
npm run dev
```

Open the URL printed by the development server (normally http://localhost:5173). The page loads district geometry immediately, then requests public data. Use the district list or keyboard-accessible map polygons to select a district. Map controls zoom/reset and toggle labels; drag to pan. District details show dated forecasts, scoring, recommended action and source links.

```sh
npm test
npm run typecheck
npm run build
```

The app uses standard Next.js App Router and React, with a Node.js route handler for `/api/pressure`. No database, application accounts, Cloudflare bindings or Sites runtime are required.

## Method: weather-deficit-v1

For each sampling location, `deficit = max(0, sum(ET0) - sum(precipitation))` over seven future local dates. District deficit is the area-weighted mean of those location deficits. Display score is `min(100, 100 * district_deficit / 30)`.

| Unrounded district deficit | Class | Recommended action |
|---|---|---|
| Below 10 mm | Low | Monitor |
| 10 to below 20 mm | Medium | Prepare restrictions for authority review |
| 20 mm or more | High | Prioritise water-saving measures and targeted monitoring |

Forecast deficit has **100%** weight. Precipitation offsets ET0 with coefficient −1; ET0 has coefficient +1. Soil moisture, EDO and discharge have **zero** score weight. Missing context never redistributes weights. Class thresholds and the 30 mm display cap are **unvalidated prototype choices**, not official Serbian, agronomic or EDO standards. Classes use unrounded values; displayed decimals can sit near a boundary. Identical classes across districts are allowed.

The district mean deficit can differ from district mean ET0 minus precipitation: negative deficits are floored to zero at each location before averaging. Raw seven-day precipitation and ET0 totals are shown independently so the calculation can be audited.

### Geographic and temporal aggregation

- Seven districts are pinned by ISO identifiers RS-01 to RS-07: North Bačka, Central Banat, North Banat, South Banat, West Bačka, South Bačka, Srem.
- A 10 km grid in equal-area EPSG:3035 is clipped to full district polygons. Every positive-area intersection gets an interior representative point and its exact area weight: **351 samples** total. This is whole-district geographic weighting, not crop or irrigated-area weighting.
- Model selection is explicitly ECMWF IFS (`ecmwf_ifs`), approximately 9 km. Requested and returned coordinates are included in the response. Adjacent samples may resolve to the same model cell; no increased physical resolution is claimed.
- We request eight days from Open-Meteo and use tomorrow through day seven in **Europe/Belgrade**. Daily provider aggregation handles daylight-saving transitions. We do not mistake a partially elapsed today for a full future day.
- Today's 00:00 model soil moisture at 7–28 cm is optional context, averaged only when all district samples have a valid value at the same valid time. It is not a measured observation or a future value labelled current.
- Boundary year, download URL, source revision, licence and retrieval time are recorded in `data/geography-source.json`. Full geography is retained for reproducibility; map rendering simplifies projected polygons by 250 m.

## Public sources and feasibility (checked 10 September 2026)

| Source | Verified availability / resolution | Role |
|---|---|---|
| [Open-Meteo ECMWF API](https://open-meteo.com/en/docs/ecmwf-api) | Global ECMWF IFS HRES, approx. 9 km, covers Vojvodina. Live precipitation and ET0 succeeded at every sample. Native time steps become coarser later in the horizon; hourly output can be interpolated. | Required forecasts. ET0 is provider-derived FAO-56 reference evapotranspiration; precipitation includes rain and snow water equivalent. |
| [Open-Meteo variables](https://open-meteo.com/en/docs) | Modelled soil moisture at defined depths, including the selected 7–28 cm layer. | Optional context only; no universal dry threshold or groundwater interpretation. |
| [EDO WMS](https://drought.emergency.copernicus.eu/data/wms-service) and [capabilities](https://drought.emergency.copernicus.eu/api/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1) | `smian` metadata: 1 arc-minute cells (about 1.3 × 1.9 km here), LISFLOOD modelled moisture anomaly, 1995–2024 baseline, ten-day cadence. Service advertised latest date 2026-07-01. | Metadata and links only. Non-queryable WMS layer; current numeric district extraction not verified. No value inferred from map colours. |
| [EDO CDI research dataset](https://pmc.ncbi.nlm.nih.gov/articles/PMC11842580/) | Published 5 km, ten-day CDI. European domain includes Serbia. Inspected v4.1 WMS advertised only through 2026-06-11. | Not scored. CDI is not interchangeable with a seven-day forecast pressure classification. |
| [JRC drought quality notices](https://joint-research-centre.ec.europa.eu/european-and-global-drought-observatories/current-drought-situation-europe_en) | Hydrological model issues since mid-May 2025, particularly western Russia; correction anticipated in a later release. | No unsupported assertion that Serbia is affected. Keep notices accessible and EDO outside score. |
| [RHMZ Novi Sad daily report](https://www.hidmet.gov.rs/latin/hidrologija/izvestajne/prognoza.php?hm_id=42035) and [station metadata](https://www.hidmet.gov.rs/latin/hidrologija/povrsinske/pov_stanica.php?hm_id=42035) | Official single-station Danube discharge, with report date and m³/s units. Live report on 2026-09-10 contained 890 m³/s. HTML source, no JSON API verified. | Optional regional context; do not substitute water level or extrapolate to district supply. |
| [geoBoundaries Serbia ADM1](https://www.geoboundaries.org/api/current/gbOpen/SRB/ADM1/) | Seven required district polygons verified in revision 9469f09; 2017 boundaries, OpenStreetMap/Wambacher origin. | District geometry, ODbL. [Pinned full data](https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/SRB/ADM1/geoBoundaries-SRB-ADM1.geojson). |

Open-Meteo forecast data are CC BY 4.0; attribute Open-Meteo and ECMWF and identify our district transformations. The free API is for non-commercial use, has no uptime guarantee, and currently limits requests to 600/minute, 5,000/hour and 10,000/day, with location/variable accounting. Educational prototyping is the intended use; review [current access terms](https://open-meteo.com/en/pricing) before operational deployment. No keys are used. Boundaries retain [OpenStreetMap attribution and ODbL](https://www.openstreetmap.org/copyright); derived boundary files remain under that licence. EDO links retain source attribution; no EDO raster is redistributed. RHMZ values are attributed individually; no bulk historical database is republished.

### API contract and failures

`GET /api/pressure` has no user-supplied coordinates, URLs or arbitrary upstream query parameters. It returns method version, future date window, retrieval time, model/resolution, seven district results, optional context statuses, and requested/returned grid coordinates. Dates identify valid periods; retrieval time is **not** model issuance time. The route returns only selected public indicators and provenance, never credentials or unfiltered upstream responses.

District status is `available` or `missing`. A missing district has null score, grade and numeric totals, a clear reason, and valid/expected sample counts. Null, negative, wrong-unit or incomplete rainfall/ET0 series invalidate the point, and any invalid point invalidates that district. No zero-filling or partial-area renormalisation is allowed. Test-only synthetic fixtures are never imported by the app.

The fixed 351 samples are batched in requests of at most 40 locations with at most three concurrent requests. In-process caching reuses complete results for six hours; failures are briefly cached for five minutes. Concurrent requests share one refresh within a warm Node.js process. There is no durable storage or global cross-region rate limiter, so this is a small educational prototype, not a public high-traffic service.

Weather data become unusable after 24 hours or at the next local date boundary when the selected future window changes. Optional EDO metadata older than 21 days is labelled stale. RHMZ parses only its explicitly labelled discharge column and report date; unexpected markup or missing values produce a missing-data message. Since publication time is absent, station reports are conservatively marked historical when their report date is two or more local calendar dates old. Optional source failures do not change classification. Source failure never causes invented fallback data.

### Limitations

ET0 is not actual crop demand; precipitation is not effective infiltration. Crop stages, irrigated area, abstraction, irrigation scheduling, runoff, soil storage, canal operations and water allocations are unavailable. No groundwater values are shown. One Danube gauge cannot establish district water supply. District averages hide farm-level variation. The score is not an official warning, probability, hydrological prediction, restriction order or guarantee of water availability. A local expert must validate and calibrate thresholds before any operational use.

### Reproduce the geography

The pinned geometry and derived map/sample files are committed; regeneration is optional, not part of normal setup.

```sh
python -m pip install shapely==2.1.2 pyproj==3.8.0
python scripts/prepare-geography.py
```

The generator checks valid polygons, exactly seven districts, positive sample areas and district-area conservation. `npm test` covers thresholds, area weighting, missing samples, invalid values, nulls, time-zone transitions, cache expiry, river parsing and geographic membership. Type checking and a production build validate the application separately.

Live smoke check on 2026-09-10: all 351 samples completed; the then-current result was one Low district and six Medium districts. These are historical verification results, not a frozen forecast or expected future classification.

## Deploy on Vercel (standard Next.js)

Import this repository with framework preset **Next.js** and the repository root as Root Directory. Use the default install command, `npm run build`, and the default Output Directory; remove any old overrides for Vinext or `dist`. The build uses `next build` and creates the standard `.next/routes-manifest.json`. Select Node.js **24.x**, matching package.json. No custom adapter or vercel.json is needed.

No environment variables or API keys are required. Remove old Sites/Cloudflare/Wrangler variables if copied from another deployment; none are read by the application. Do not add a database or authentication integration. Public source URLs are fixed server-side; forecast requests are not made during the build.

Keep Vercel Fluid compute enabled: `/api/pressure` declares a 120-second maximum duration for its bounded forecast batches. In-process caching is opportunistic and can disappear on cold starts or deployments; separate function instances do not share it. All responses use `Cache-Control: no-store`, and all upstream fetches bypass Next.js caching so no CDN or framework cache can extend the validity window. This remains a small educational prototype subject to upstream rate limits.

Validate locally with `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`. Run the production server with `npm start` and open http://localhost:3000; development remains on http://localhost:5173 with `npm run dev`. After deploying, check both `/` and `/api/pressure`; upstream outages must produce clearly missing district scores.

References: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [route runtime and duration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config), [Vercel function limits](https://vercel.com/docs/functions/limitations).

Migration validation (11 September 2026): clean npm ci, nine domain tests, ESLint, TypeScript and next build passed. The production server returned HTTP 200 for the page and API, with all seven districts and all 351 sample locations available. Restricted-network testing returned missing scores rather than invented values. The standard .next/routes-manifest.json is generated. Vercel deployment itself has not yet been run for this migration.

## Monitoring guidance

The regional summary highlights the three largest forecast deficits as starting points for targeted monitoring only when all seven districts have complete data. This is not a new score, validated top-three cutoff, or restriction order. Ranks use unrounded deficits; equal displayed values can rank differently, and small differences may not be meaningful. Local supply, canal operations, crop needs and allocations must be checked before considering restrictions. District precipitation and ET0 show their forecast window and retrieval time beside the source link. The interface describes the opportunistic per-instance cache rather than promising a global six-hour refresh interval.
