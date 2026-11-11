# Avatar pipeline research: photo → rigged, animated, mobile-ready character

**Date:** 2026-11-11 · **Feeds:** "prove personalisation" milestone · **Status:** desk research only. Nothing was generated, purchased or tested. Not legal advice.

## How to read this note

- **Evidence limit.** This session's network policy blocked every direct page fetch (`developers.tripo3d.ai`, `developers.tripo3d.com`, `platform.tripo3d.ai`, `docs.meshy.ai` all failed to resolve; the environment's allowlist holds no documentation hosts). Every external fact below therefore rests on **search-engine excerpts of the cited official page, retrieved 2026-11-11**. No vendor, Apple or FTC page was opened and read in full. Re-read the live page before paying, signing or submitting.
- **DOC** = stated by the cited official page (via excerpt). **UNVERIFIED** = not confirmed from a primary source, or official pages contradict each other. **INFERRED** = our reasoning. **MUST-MEASURE** = only an experiment can answer.
- Tags such as `[T3]` resolve in the Sources table. All were accessed 2026-11-11.
- No numbers are invented. Sums of documented unit prices are labelled "computed".

## Bottom line

1. **Pets decide the vendor question.** Tripo's API documents quadruped auto-rigging. Meshy's API rigging page says humanoid only; its web app lists a quadruped option, so API support is UNVERIFIED.
2. **Neither vendor's presets cover our 13 `CharacterAction` states.** Tripo documents one quadruped preset (walk) and eleven biped presets. Any generated rig still needs our own animation layer (INFERRED).
3. **Our own art bible currently rules out approaches (b) and (c):** "No external textures or models", ≤ 6k triangles, and separable eyes, brows and mouths `[R1]`.
4. **A photo that leaves the device is the expensive legal step.** Apple requires explicit permission before sharing personal data with third-party AI. For children, COPPA treats the photo as personal information and requires verifiable parental consent, with separate consent for third-party disclosure.
5. **The cheapest informative experiment is approach (a)**, which the existing `CharacterSpec` contract was written for `[R2]`. It needs no vendor account.

## 1–2. Tripo and Meshy (official API documentation)

| Topic | Tripo | Meshy |
|---|---|---|
| Image-to-3D | DOC: H series (`v3.1-20260211` recommended) and P series (`P1-20260311`, `P2-20260801`). Input PNG/JPEG/WebP, ≤ 20 MB, ≥ 256×256 recommended, by URL or `file_token` `[T1][T2][T18]`. Maximum resolution: UNVERIFIED. | DOC: `POST /openapi/v1/image-to-3d`; `ai_model` meshy-7.1, meshy-6, meshy-6-lite; `model_type` standard or smart-topology; `pose_mode` (e.g. a-pose). Input JPG/PNG/WebP, ≤ 20 MB, URL or data URI `[M1]`. |
| Auto-rigging: quadrupeds? | DOC: **yes.** `rig_type` = biped (default), quadruped, hexapod, octopod, avian, serpentine, aquatic. Non-biped needs rig model `v2.5-20260210` set explicitly; `v3.0-20260909` is recommended for humanoids. A free rig-check returns `riggable` and a suggested type `[T3][T4][T7]`. A showcase reports a 41-bone quadruped skeleton `[T17]`. | DOC: the API rigging page supports **textured humanoid (bipedal)** models and lists non-humanoid and untextured meshes as unsuitable; ≤ 380,000 triangles `[M2]`. The web-app guide lists "Quadruped Dog" `[M3]`. Quadruped via API: **UNVERIFIED** (pages conflict). Text-to-Motion needs a biped rig `[M18]`. |
| Animation presets and retargeting | DOC: retarget applies presets to a rigged model. Biped: idle, walk, run, dive, climb, jump, slash, shoot, hurt, fall, turn. Quadruped: `preset:quadruped:walk` only `[T4][T5]`. Biped rigs can target `tripo` or `mixamo` skeletons (more on v3.0) `[T3]`. Which presets work on which rig version: UNVERIFIED (API page and ComfyUI page conflict) `[T15]`. | DOC: presets applied by `action_id`, up to 10 per request; free library-listing endpoint `[M4]`. Rigging optionally returns walk and run clips `[M2]`. `skeleton_template` (mixamo, ue5_mannequin) added 10 Nov 2026, biped only `[M10]`. Web guide: four-legged characters get a walk; the library is for humanoids `[M15]`. Library size ("600+") is a marketing-page title: UNVERIFIED `[M20]`. |
| Output formats | DOC: rig and retarget output GLB (default) or FBX `[T3][T5]`. Convert to GLTF, FBX, USDZ, OBJ, STL, 3MF `[T6]`. | DOC: rigging returns FBX and GLB `[M2]`. Remesh targets glb, fbx, obj, usdz, blend, stl, 3mf `[M5]`. |
| Polygon and texture controls | DOC: `face_limit`; `smart_low_poly` 500–20,000 triangles (500–10,000 quads), "complex models may occasionally fail"; `texture`, `pbr`, `texture_quality` standard/detailed `[T1]`. Convert: `face_limit`, `texture_size` (default 4096), `texture_format` `[T6]`. | DOC: `should_remesh`, `topology`, `target_polycount`; smart-topology range 100–30,000, default 15,000 `[M1][M10]`. Remesh API 100–300,000 `[M5]`. `should_texture`, `enable_pbr`; 2K/4K/8K texture tiers `[M6]`. |
| Async job model | DOC: create task, then poll about every 2 s or use webhooks (`task.completed`, `task.failed`, retried on non-2xx). Statuses queued, running, success, failed, cancelled; sample code also handles banned and expired. Typical generation 10–120 s `[T7][T8][T19]`. | DOC: create task, poll until SUCCEEDED, FAILED or CANCELED honouring `Retry-After`; SSE streams on several endpoints; webhooks `[M9][M17]`. Typical duration: UNVERIFIED. |
| Pricing | DOC: 1 credit = US$0.01. Image-to-3D 20 credits untextured, 30 with standard texture (H series); detailed texture +10; P1 40–50. Rig-check 0, rig 25, retarget 10 per animation, convert 5–10. Failed and cancelled tasks are not charged `[T9]`. Surcharges for `smart_low_poly` and `quad`: UNVERIFIED. **Computed:** textured model + rig + one clip = 65 credits = US$0.65. | DOC: rigging 5 per request, animation 3 per action, remesh 5, retexture 10 (15 at 8K). Failed tasks refunded. Prepaid credits; the free plan has no API access `[M6][M19]`. Image-to-3D: 20 untextured / 30 textured `[M16]`, but a help article says 25: UNVERIFIED. US$ per credit: UNVERIFIED. **Computed:** 30 + 5 + 3 = 38 credits. |
| Rate limits | DOC: account concurrency pools — H-series generation 10, P-series 5, animation 10, model processing 5, mesh operations 10, image generation 1; raisable on request. HTTP 429 on excess `[T10]`. Numeric request rates: UNVERIFIED. | DOC: Pro 20 requests/s and 10 queued tasks; Studio 20 and 20; Enterprise 100 and 100. Shared across keys and the web app `[M7]`. |
| Commercial use and output ownership | DOC: help page says paid users may use, modify, distribute and commercially exploit outputs; for free users Tripo retains all rights to inputs and outputs `[T11][T13]`. Outputs are non-exclusive `[T11]`. Whether these terms govern paid **API** use: UNVERIFIED — the developer-terms excerpt is cut off and contains another company's name ("Holymolly") `[T11]`. | DOC: free plan — Meshy owns outputs and licenses them under CC BY 4.0. Paid customers own their assets if they do not publish them to the community and their inputs infringe nothing `[M11][M21]`. |
| Photo-of-person policy | DOC: users are solely responsible for inputs; no impersonation; no personal data of under-13s without parental consent `[T11]`. Likeness or biometric clause: UNVERIFIED (none found). | DOC: users agree not to put personally identifiable information about themselves or third parties in inputs; users must be 14+; the AUP bars violating others' privacy or publicity rights `[M11][M13]`. INFERRED: a friend's face photo may breach this as written. Biometric handling: UNVERIFIED. |
| Data retention | DOC: output URLs expire after 5 minutes `[T7]`. Tripo has no obligation to store inputs or outputs `[T11]`. API models are private by default and scheduled deletion is configurable `[T14]`. Fixed retention period: UNVERIFIED. | DOC: API-generated models are kept at most 3 days (Enterprise: indefinitely); signed URLs stop at `expires_at` `[M8]`. Input-image retention: UNVERIFIED. |
| Training on customer data | DOC: Terms say paid users' inputs and outputs are not used for training; free users get no such limit `[T12]`. Privacy policy: personal information is not used for training, but anonymised prompts and outputs may be `[T12]`. Applicability to API accounts: UNVERIFIED. | DOC: Terms allow training on non-Enterprise inputs and outputs unless the Order says otherwise; opt-out by email; Enterprise excluded `[M11][M14]`. A help article says no user data is currently used: conflict, UNVERIFIED `[M14]`. |

## 3. Other options and the "no generator" option

| Option | What the documentation states | Gaps |
|---|---|---|
| Anything World (rigs and animates an existing mesh) | DOC: REST API accepts OBJ, GLB, GLTF, FBX, DAE; returns FBX and GLB; processing about 10 minutes; model types include animals and four-legged characters; extra animations limited to humanoids, cats, dogs and horses `[O1][O2][O3]`. | Excerpts looked dated. Pricing, terms and current availability: UNVERIFIED. Does not create geometry. |
| Adobe Mixamo | DOC: auto-rigger and library are for bipedal humanoids only; royalty-free commercial use `[O4]`. | API availability and terms: UNVERIFIED. No use for pets. |
| Ready Player Me | None captured. | Reported shut down 31 Jan 2026: UNVERIFIED (secondary sources only). Cited only as a vendor-dependency warning. |
| **No generator:** in-house parametric template | DOC (repo, read directly): `CharacterSpec` describes a character entirely as data (species, build, colours, hair, ears, tail, pattern) "so it can be… produced by a photo-interpretation step"; every species shares one collider and anchor set `[R2]`. Art bible sets ≤ 6k triangles and ≤ 30 draw calls per character `[R1]`. | Vision-model accuracy, cost and data terms were not researched: MUST-MEASURE. If the player sets the parameters, no photo is needed (INFERRED: removes the photo obligations in section 4). |

## 4. Platform and legal constraints (primary sources)

| Source | What it states (DOC) | Bearing on us (INFERRED) |
|---|---|---|
| Apple 1.2 User-Generated Content `[A1][A3]` | Apps must filter objectionable material, offer reporting with timely response, let users block abusers, and publish contact details. An update names AI-generated non-consensual intimate imagery. | Shared avatars of real people are UGC. We need report, block and removal from first release. |
| Apple 5.1.1 (i)(ii)(iii)(v) `[A1][A6]` | Privacy policy must cover data, uses, retention and deletion; consent is required for collection; request only data relevant to core functionality; in-app account deletion. Exact current wording: UNVERIFIED. | Photo upload needs a consent step and a deletion path. |
| Apple 5.1.2(i) `[A2]` | Must clearly disclose where personal data is shared with third parties, **including third-party AI**, and get explicit permission first. | Sending a photo to Tripo, Meshy or a vision API needs a named, explicit consent screen. |
| Apple 5.1.2(vi) `[A5]` | Data from facial-mapping tools (ARKit, Camera, Photo APIs) may not be used for marketing, advertising or use-based data mining. | No reuse of face data beyond building the avatar. |
| Apple 1.3 Kids Category and 5.1.4 `[A1]` | Kids Category apps may not send personally identifiable or device information to third parties, and need a parental gate for purchases and links out. Developers must comply with children's privacy laws; a parental gate is not parental consent. | A Kids Category listing appears incompatible with cloud photo-to-avatar. |
| Apple 3.1.1 and 3.1.1(a) `[A1][A5]` | In-app purchase is required to unlock features and in-game currencies. Loot boxes or other randomised purchasable items must disclose the odds of each item type before purchase. US storefront apps may include external purchase links. | Any random cosmetic drop sold for money or paid currency needs an odds screen. Per-item versus per-rarity granularity: UNVERIFIED. |
| FTC COPPA Rule, 16 CFR 312.2 `[F1][F2]` | Personal information includes a photo, video or audio file containing a child's image or voice. The 2025 amendments add biometric identifiers such as facial templates and faceprints. | A child's reference photo is personal information on its own. |
| FTC final rule, dates `[F1][F5]` | Published 22 Apr 2025; effective 23 Jun 2025; compliance by 22 Apr 2026 except § 312.11(d)(1), (d)(4) and (g). | The amended rule is fully in force today. |
| FTC final rule, avatars `[F1][F6]` | The FTC declined to make an avatar generated from a child's image personal information by itself, but it is personal information when combined with other personal information, and the FTC may revisit. | The derived avatar is lower risk than the photo, but not exempt once tied to an account. |
| 16 CFR 312.5, parental consent `[F3][F4]` | Consent must be reasonably calculated to confirm the person is the parent. Listed methods include government-ID check, knowledge-based authentication, and photo-ID-to-selfie face match, each with prompt deletion; text-plus only where data is not disclosed. **Separate consent** is required for third-party disclosure unless integral to the service. Full method list: UNVERIFIED. | A 3D-generation vendor is a third-party disclosure. Whether it is "integral" is a legal question. |
| FTC COPPA FAQ, photos `[F4]` | Operators must prescreen and delete children's photos (of themselves **or other children**) or obtain parental consent before upload. An app that only works with data stored on the device, never transmitted, is not collecting it. | On-device or player-set personalisation avoids "collection". Friends' photos are covered too. |
| FTC final rule, § 312.10 `[F1]` | Written retention policy required; children's data may not be retained indefinitely. | Delete reference photos once the avatar is accepted. |

## 5. Approach comparison

(a) approved templates with personalised features and materials · (b) freely generated geometry · (c) hybrid: template body and rig, generated or fitted parts.

| Criterion | (a) Templates | (b) Generated geometry | (c) Hybrid |
|---|---|---|---|
| Recognition | MUST-MEASURE. The art bible's five-lever claim is a hypothesis `[R1]`. | MUST-MEASURE. | MUST-MEASURE. |
| Appeal consistency | INFERRED high: every part is authored to the art bible. | INFERRED variable: output style is not under our control. MUST-MEASURE. | INFERRED medium: seams between authored and generated parts. MUST-MEASURE. |
| Animation stability | INFERRED high: one rig per species; fixed anchors are already a contract (DOCUMENTED `[R2]`). | DOCUMENTED limits: Tripo has one quadruped preset `[T5]`; Meshy API rigging is humanoid only `[M2]`. INFERRED: per-output skeletons need our own retargeting for 13 actions. | INFERRED high for the body; attached parts MUST-MEASURE. |
| Manual repair | INFERRED none per player; cost moves to up-front authoring. | MUST-MEASURE. DOCUMENTED: `smart_low_poly` "may occasionally fail" on complex models `[T1]`. INFERRED: no human repair is possible inside a consumer flow. | MUST-MEASURE: fitting and normalising parts. |
| Generation cost | INFERRED: no 3D-generation fee; at most one vision call (MUST-MEASURE), or zero if player-set. | DOCUMENTED unit prices: Tripo 55 credits + 10 per clip at US$0.01 `[T9]`; Meshy 35 credits + 3 per action `[M6][M16]`. Retries: MUST-MEASURE. | DOCUMENTED per generated part: Tripo 20–30 credits, no rig fee `[T9]`. Parts per avatar: MUST-MEASURE. |
| Failure rate | MUST-MEASURE (attribute misreads). INFERRED: no geometry failures. | MUST-MEASURE. DOCUMENTED: failures are not charged `[T9][M6]`; Tripo rig-check is free `[T3]`. | MUST-MEASURE. |
| Mobile performance | DOCUMENTED budget: ≤ 6k triangles, ≤ 30 draw calls `[R1]`. Frame time: MUST-MEASURE. | DOCUMENTED controls reach the budget: Tripo 500–20,000 triangles `[T1]`, Meshy 100–30,000 `[M10]`. Quality at ≤ 6k and texture memory: MUST-MEASURE. Breaks "no external textures or models" `[R1]`. | INFERRED: bounded by per-part `face_limit` `[T1]`. MUST-MEASURE. |
| Time to accepted result | INFERRED seconds. MUST-MEASURE. | DOCUMENTED: Tripo 10–120 s per task `[T7]`; INFERRED at least three sequential tasks. Meshy: MUST-MEASURE. | MUST-MEASURE. |

## 6. What to measure first

**Sample set (synthetic or authorised only).** About 30 references: 12 people, 9 dogs, 9 cats. Use AI-generated or commissioned images, or team members and their own pets with a signed release. No children. No third parties without a release. Vary angle, lighting, occlusion, hair, glasses, coat pattern.

**Order.**
1. Approach (a), no vendor: photo → `CharacterSpec` by vision model, and separately by a player using the editor.
2. Approach (b): Tripo full pipeline for all species; Meshy for humans, and for pets only if its API accepts them.
3. Approach (c): template body with one generated part (hair or head).

**Computed budget for step 2 on Tripo:** 30 references × 65 credits = 1,950 credits = US$19.50 before retries `[T9]`.

**Metrics.**

| Metric | How |
|---|---|
| Recognition | Blind line-up: a panel matches each avatar to its reference among five, at 48 px and at gameplay camera. |
| Appeal consistency | Art-director pass or fail against the art bible, plus pairwise preference. |
| Animation stability | Visible defects per character across all 13 `CharacterAction` states; anchor error against `RIG` constants. |
| Manual repair | Minutes of human work per accepted character. |
| Cost | Credits per **accepted** character, retries included. |
| Failure rate | API failures plus rejected outputs, over attempts. |
| Mobile performance | Triangles, draw calls, texture memory, frame time on the floor device. |
| Time to accepted result | Median and 95th percentile, request to accepted. |

**Thresholds:** to be set by the founder before the run. Existing hard gates: ≤ 6k triangles, ≤ 30 draw calls, anchors exactly on `RIG` constants `[R1][R2]`.

## 7. Open questions

**Founder decisions**
1. Audience: general, mixed, or children? This decides whether COPPA consent and the Kids Category rules apply.
2. May a photo ever leave the device? If not, only (a) with on-device or player-set parameters remains.
3. Friends' photos: what consent do we require from the person pictured?
4. Do we relax "No external textures or models" in the art bible? (b) and (c) break it as written.
5. Are randomised purchasable cosmetics planned? If so, odds disclosure is mandatory.
6. Which vision-model provider for (a), and under what data terms? Not researched here.

**Needs a paid account or written vendor answer**
7. Tripo: which terms govern API use; ownership and no-training in writing; retention period; quadruped rig quality; preset compatibility by rig version.
8. Meshy: does the API rig quadrupeds; is a face photo permitted input; training opt-out terms; price per credit.
9. Both: a data-processing agreement covering photos of people.

**Needs counsel**
10. Is disclosure to a 3D-generation vendor "integral" under § 312.5? State biometric laws were not researched.

## Sources (all accessed 2026-11-11, via search excerpt unless marked "read directly")

| Tag | URL |
|---|---|
| T1 | https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard |
| T2 | https://developers.tripo3d.ai/en/docs/generation-image-to-model/p |
| T3 | https://developers.tripo3d.ai/en/docs/animations-rig |
| T4 | https://developers.tripo3d.ai/en/models/rig |
| T5 | https://developers.tripo3d.ai/en/docs/animations-retarget |
| T6 | https://developers.tripo3d.ai/en/docs/models-convert |
| T7 | https://developers.tripo3d.ai/en/docs/quick-start |
| T8 | https://developers.tripo3d.ai/en/docs/webhooks |
| T9 | https://developers.tripo3d.ai/en/pricing · https://developers.tripo3d.ai/en/docs/billing · https://docs.tripo3d.ai/get-started/pricing.html |
| T10 | https://developers.tripo3d.ai/en/docs/rate-limits |
| T11 | https://developers.tripo3d.ai/en/terms |
| T12 | https://www.tripo3d.ai/terms · https://www.tripo3d.ai/privacy |
| T13 | https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially |
| T14 | https://www.tripo3d.ai/help/privacy-policy/is-my-asset-safe |
| T15 | https://developers.tripo3d.ai/en/docs/comfyui-nodes |
| T17 | https://developers.tripo3d.ai/en/showcase/forest-deer |
| T18 | https://developers.tripo3d.ai/en/docs/files |
| T19 | https://developers.tripo3d.ai/en/docs/introduction |
| M1 | https://docs.meshy.ai/en/api/image-to-3d |
| M2 | https://docs.meshy.ai/en/api/rigging |
| M3 | https://docs.meshy.ai/en/webapp/guides/3d-model/rigging |
| M4 | https://docs.meshy.ai/en/api/animation · https://docs.meshy.ai/en/api/animation-library |
| M5 | https://docs.meshy.ai/en/api/remesh |
| M6 | https://docs.meshy.ai/en/api/pricing |
| M7 | https://docs.meshy.ai/en/api/rate-limits |
| M8 | https://docs.meshy.ai/en/api/asset-retention |
| M9 | https://docs.meshy.ai/en/api/quick-start |
| M10 | https://docs.meshy.ai/en/api/changelog |
| M11 | https://www.meshy.ai/terms-of-use · https://www.meshy.ai/privacy-policy |
| M13 | https://www.meshy.ai/acceptable-use-policy |
| M14 | https://help.meshy.ai/en/articles/15724182-is-meshy-safe-and-private-data-and-training-faq · https://help.meshy.ai/en/articles/9992010-are-the-concept-art-images-uploaded-in-image-to-3d-used-to-train-your-model |
| M15 | https://docs.meshy.ai/en/webapp/guides/animate |
| M16 | https://www.meshy.ai/api |
| M17 | https://help.meshy.ai/en/articles/16102100-meshy-api-webhooks-vs-polling-when-results-are-ready |
| M18 | https://docs.meshy.ai/en/api/text-to-motion |
| M19 | https://help.meshy.ai/en/articles/16815622-how-many-credits-does-each-meshy-api-task-cost |
| M20 | https://www.meshy.ai/features/ai-animation-generator |
| M21 | https://help.meshy.ai/en/articles/9992001-can-i-use-my-generated-assets-for-commercial-projects |
| O1 | https://anything-world.gitbook.io/anything-world/api/rest-api-references |
| O2 | https://anything-world.gitbook.io/anything-world/animate-anything-3d-software-plugins/animate-anything-blender-add-on-manual |
| O3 | https://anything-world.gitbook.io/anything-world/master/faq |
| O4 | https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html |
| A1 | https://developer.apple.com/app-store/review/guidelines/ |
| A2 | https://developer.apple.com/news/?id=ey6d8onl |
| A3 | https://developer.apple.com/news/?id=vvzx6cul |
| A5 | https://developer.apple.com/support/downloads/terms/app-review-guidelines/App-Review-Guidelines-English-UK.pdf (older copy) |
| A6 | https://developer.apple.com/news/?id=mdkbobfo |
| F1 | https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule |
| F2 | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2 |
| F3 | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.5 |
| F4 | https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions |
| F5 | https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments |
| F6 | https://www.ftc.gov/news-events/news/press-releases/2023/06/ftc-will-require-microsoft-pay-20-million-over-charges-it-illegally-collected-personal-information |
| R1 | `docs/ART_BIBLE.md` (this repository, read directly) |
| R2 | `src/kit/contracts.ts` (this repository, read directly) |
