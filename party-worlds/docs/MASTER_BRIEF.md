# Master Brief — BounceBack Party Worlds

> The founder's charter, preserved verbatim (received 2026-11-11). This is the source of intent for the project.
> Only formatting was added: section titles became headings and the section dividers became rules. No wording was changed.
> Where this brief and a later decision differ, the decision record (`docs/DECISIONS.md`) says so explicitly.

## BOUNCEBACK PARTY WORLDS — MASTER CREATIVE AND EXECUTION CHARTER

Intended environment: Claude Code working in the actual game project
Requested model: Claude Fable 5.2
Requested starting effort: Extra High (xhigh)
Founder: Brenden
Working title: BounceBack Party Worlds — replace it if you discover a stronger original name

---

## 1. Your mission

Create an original social game with exceptional imagination, physical feel, visual identity, usability, multiplayer reliability, and replay value.

Take ownership of the invention, design, implementation, verification, and refinement. Act as an integrated game studio: creative director, game designer, gameplay engineer, technical artist, multiplayer engineer, UX designer, sound director, QA lead, and commercially disciplined product owner.

The emotional promise is:

OUR PEOPLE AND PETS, INSIDE IMPOSSIBLE LITTLE WORLDS.

Players become recognizable, expressive, comically realistic animated versions of themselves, their friends, their dogs, or their cats. Together, they enter miniature worlds hidden inside ordinary objects and places.

They might race between couch cushions, launch themselves across a birthday cake, fish in a lunchbox river, coordinate a ridiculous contraption, steal a shortcut, or become the enormous character operating the world around everyone else.

The game should produce moments people immediately want to share with someone they care about.

A father and son should have a wonderful session together. A couple should enjoy playing side by side or across a distance. Friends should compete, cooperate, develop rituals, and form crews. A solo player should find satisfying mastery and meaningful challenges.

The same cast can drive, run, jump, balance, grab, build, fish, pan, launch, catch, coordinate, and manipulate the environment.

Aim for the craftsmanship and appeal of a category-defining game. Pursue the quality, discovery, and distribution needed to compete for major App Store success. Treat rankings and commercial success as outcomes to earn and measure.

Make the ambition tangible through playable results.

---

## 2. Operate in the right environment

This assignment is intended for Claude Code with access to the project, development tools, and relevant build environment.

Verify the environment before making assumptions

Inspect:

* The current workspace and repository.
* Existing instructions and project conventions.
* The actual files already present.
* Available engine installations and versions.
* Build tools, package managers, and target platforms.
* Available visual inspection and game interaction tools.
* Existing backend services and credentials, without exposing secrets.
* Existing tests, assets, integrations, and uncommitted work.
* The selected model and effort setting where the runtime makes those observable.

Do not claim that a model, tool, service, engine, or integration is available merely because this brief mentions it.

The requested model is claude-fable-5-2, with xhigh for the initial demanding creative and implementation work. Verify compatibility against current official documentation where necessary.

Effort is a runtime setting. Do not pretend that writing “maximum intelligence” in an answer changes it. Do not launch nested Claude sessions simply to simulate changing the current session’s configuration.

If the effective setting is not observable, state that briefly and continue useful work.

Apply effort deliberately

Use this operating policy where the environment supports it:

* Extra High: initial synthesis, consequential architecture decisions, difficult implementation, and complex problems spanning several systems.
* High: routine implementation, ordinary debugging, polishing, integration, and build repairs.
* Max: selected, bounded problems where additional reasoning may materially improve correctness or resolve a difficult uncertainty.
* Medium: straightforward support work where quality remains sufficient.

Do not equate greater token use with better work. Judge effort by the quality of decisions, implemented behavior, verification, and progress.

If changing effort requires an operator action, recommend the change at a sensible boundary. Continue work that remains productive at the current setting.

Use the actual development environment

A local terminal session and a local Claude Desktop Code session can both serve this project. What matters is access to the same project, tools, and feedback.

If the project targets Unity and iOS, verify the actual Unity, platform support, and Apple build-tool requirements. A browser prototype can answer a focused design question, but it does not establish a native iOS build.

When a required tool is missing, complete all useful independent work, prepare a concrete setup step, and explain the exact dependency.

---

## 3. Creative authority and decision hierarchy

You have broad creative authority.

Surprise me. Improve the concept. Find possibilities we have not described. Challenge weak assumptions and replace mediocre mechanics with stronger ones.

Do not inherit an outdated ceiling from earlier models or workflows. Investigate current capabilities, test ambitious approaches, and solve the difficult parts.

Keep a clear distinction between demonstrated capability and an untested possibility.

Preserve these promises

* Recognizable, expressive people and pets.
* Social connection and shared laughter.
* Distinct miniature worlds with physical personality.
* Meaningfully varied activities.
* Accessible entry with room for mastery.
* Strategy that changes the action in understandable ways.
* Fair competition and transparent scoring.
* Excellent mobile usability and performance.
* A sustainable business that preserves trust.
* A coherent identity across the entire experience.

Treat these as replaceable hypotheses

* The title.
* Individual mini-games.
* Exact controls and cameras.
* Board layout and resource names.
* Session length and round order.
* Progression details.
* Engine and service choices.
* Art execution.
* Production sequence.
* The specific mechanisms proposed in this document.

The attraction bank is creative material. It is not a requirement to manufacture every suggestion.

When priorities conflict, preserve the emotional promise, playable quality, technical honesty, and competitive integrity. Change implementation details as needed.

Explain significant decisions concisely. Present conclusions, evidence, and tradeoffs without filling the conversation with an internal reasoning transcript.

---

## 4. Understand the desired feeling

Use these references to understand the experience we are reaching for:

* Mario Kart: playful rivalry, readable physical action, expressive vehicles.
* Mario Party: social variety, anticipation, shared surprises.
* Catan: choices with consequences and opportunities to read other players.
* Super Smash Bros.: expressive interaction, recoveries, mastery.
* NFL Blitz: immediacy, physical comedy, energetic competition.
* Rocket League: satisfying movement, spatial skill, improvement through practice.
* Temple Run: readable momentum, obstacle anticipation, quick decisions.
* Physical arcade games: tactile timing, aiming, grabbing, balancing, and satisfying contact.

Create our own characters, environments, items, interface, sound, visual language, and distinctive combinations of mechanics.

The player should feel both familiarity and discovery.

Someone should understand the first action quickly, then discover possibilities that reward curiosity and skill.

The humor should emerge from recognizable characters, physical consequences, reactions, and relationships. Use restraint with forced jokes and excessive presentation.

---

## 5. Reverse-engineer the experience from memorable moments

Design backward from moments such as:

* “That ridiculous little character looks exactly like my dog.”
* “You launched yourself, and I actually caught you.”
* “I knew you were going for that shortcut.”
* “Our decision changed the next round.”
* “I thought we had lost, then we pulled that off together.”
* “I understand why I lost, and I want another try.”
* “Wait until you see what happens in this world.”
* “We have to invite them.”

For each intended moment, identify:

1. The player action.
2. The decision or skill involved.
3. What another player contributes.
4. What makes the outcome understandable.
5. The animation, camera, sound, and feedback needed.
6. The networking behavior required.
7. The smallest playable experiment that can test it.

Make the amusing moments consequences of play.

Design success, failure, recovery, and celebration with equal care.

A near miss can be delightful when the player understands it. A failure caused by unclear controls, hidden rules, or network disagreement needs correction.

---

## 6. Discover the strongest central loop

Before committing to production architecture, develop several meaningfully different candidates for the central loop.

Compare them on:

* Distinctive identity.
* Immediate readability.
* Physical satisfaction.
* Social interaction.
* Strategic depth.
* Room for mastery.
* Variety without excessive relearning.
* Production feasibility.
* Technical uncertainty.
* Expansion potential.
* Ability to communicate through actual gameplay footage.

Recommend one direction promptly.

Prototype the largest uncertainty in its appeal before expanding the surrounding systems.

Do not spend the entire engagement inventing names, producing elaborate documents, or building abstractions for hypothetical future features.

Your first proof should be an enjoyable interaction with:

* A clear beginning.
* A meaningful decision or skillful middle.
* A readable outcome.
* A satisfying finish.
* A compelling reason to retry.

A menu, a mock lobby, or a collection of empty mode classes does not count as playable progress.

---

## 7. Three signature possibilities to challenge or exceed

A. Launch someone you know

A player aims and launches their own recognizable character from a spoon, slingshot, or miniature catapult.

Their partner positions the receiving basket or landing apparatus.

The flying player retains one understandable action, such as bracing, adjusting a small glider, or choosing when to deploy a parachute.

Roles swap.

The humor comes from the character. The mastery comes from trajectory, timing, midair judgment, and catching.

Explore the relationship between anticipation, release, flight, uncertainty, and impact. Make a successful landing physically satisfying.

B. Become the giant outside the world

A player’s enormous animated character operates the claw, flashlight, tray, snowglobe, or other mechanism surrounding the miniature players.

Changing scale changes what the player can do.

The giant needs:

* Clear controls.
* Bounded reach.
* Readable preparation.
* Cooldowns or resource constraints.
* Interesting prediction.
* Counterplay.

The miniature players need:

* Understandable threats.
* Opportunities to bait, cooperate, evade, and recover.
* Useful environmental choices.
* A way to remain involved after a setback.

Personalized appearance must remain separate from competitive reach and collision behavior.

C. Share one difficult physical task

Two people control one crate, balloon, fishing operation, tether, raft, launch system, or contraption.

Both players make meaningful decisions.

Avoid assigning the less experienced player a permanent waiting or support role. Swap responsibilities or make each role equally interesting in a different way.

The interaction should create communication naturally:

“Hold it there.”

“Wait.”

“Now.”

“I’ve got you.”

Find something beyond these

Invent at least one additional signature possibility that is absent from this brief.

It might come from:

* An unexpected relationship between players.
* A surprising use of scale.
* A physical rule that supports several activities.
* A consequence that persists between rounds.
* A mechanic that combines cooperation and rivalry elegantly.

Choose the most promising ideas through prototypes and observation.

---

## 8. Build variety from a small number of expressive interaction families

Use these as a starting design vocabulary:

1. On-foot movement: running, jumping, balance, climbing, chase.
2. Vehicles: steering, bumping, transport, drifting, positioning.
3. Aiming and launching: trajectories, catching, rebounds, timed release.
4. Grabbing and manipulating: claws, carrying, stacking, assembly, machinery.
5. Precision and flow: fishing, tension, panning, sifting, currents.
6. Timing and reaction: rhythm, pressure, memory, selective attention.

Three-versus-one is a role arrangement that can use these systems.

Share systems where the benefit is real:

* Player identity.
* Character presentation.
* Parties and invitations.
* Session state.
* Input conventions.
* Accessibility.
* Scoring presentation.
* World transitions.
* Networking foundations.
* Progression and entitlements.

Allow each attraction to retain its physical identity.

Fishing should have anticipation and tension. Launching should have aim and release. Driving should have momentum. Grabbing should have weight and contact.

Extract reusable systems from functioning examples. Do not build six speculative engines before proving the first attraction.

---

## 9. Make the board strategically meaningful

The board is a miniature world with consequential choices.

It should influence later action through understandable changes to:

* Routes.
* Terrain.
* Hazards.
* Objectives.
* Equipment tradeoffs.
* Team plans.
* Risk and reward.

Working hypothesis: between attractions, players make a short, visible choice that changes the shared next arena.

Examples:

* Open a safer but slower route.
* Add a rebound surface that opponents might also exploit.
* Select a difficult delivery objective for greater potential reward.
* Change a gate, fan, or platform.
* Carry a limited match-earned tool into the next activity.

Find a stronger system if these examples are insufficient.

Define exactly:

* Who chooses.
* What choices exist.
* What each choice costs.
* When choices become visible.
* How conflicts resolve.
* How long the phase lasts.
* How the next attraction communicates the consequences.

Keep the initial economy small.

Bound resources and reset appropriate advantages between tours.

Winning may create options without granting permanent superior physics. Comeback opportunities should require decisions and skill.

Test this question:

Can a player point at something happening in the arena and explain which earlier choice caused it?

Connect the session through a small number of recurring objects or consequences. Something recovered in one attraction might become an arena ingredient later.

Use these links selectively. The session should become an understandable shared story.

---

## 10. Give worlds physical personality

Every production world needs:

* A distinctive visual identity.
* A memorable physical behavior.
* A strategic board decision.
* Attractions that belong there.
* Recognizable landmarks.
* A coherent sound palette.
* Transitions that preserve the feeling of place.

Initial world candidates follow.

The Place Between the Cushions

A lost-object civilization inside a sofa.

Coins become plazas. Springs become bridges. A remote becomes a tower. Compressing cushions open and close passages.

The world’s behavior involves shifting weight, flexible surfaces, hidden spaces, and objects slipping between layers.

Granddad’s Radio

A warm mechanical city inside a wooden radio.

Tuning mechanisms create routes. Speaker cones become platforms. Rhythm drives machinery.

The world’s behavior involves vibration, synchronization, rotating components, and changing frequencies represented through readable physical events.

The Birthday Continental

A birthday table becomes a landscape.

Cake cliffs, wafer bridges, balloon harbors, moving plates, and spoon catapults create a world of playful scale.

The world’s behavior involves flexible surfaces, rolling ingredients, air pressure, and launch opportunities.

Bailey’s Tag Town

A miniature world around collar tags, a buckle, a leash clip, and enormous soft tufts of fur.

Bailey is the founder’s dog. Do not invent a claim of accurate likeness without an authorized reference.

Use a representative prototype dog until appropriate references are supplied.

The setting should feel affectionate and comfortable. Keep the animal free from distress or rough treatment.

The Snowglobe Republic

A small mountain town inside a glass sphere.

Bounded tilts, gusts, rolling snow, and changing inside/outside roles affect routes and objectives.

The world should remain readable when its physical state changes.

The Lunchbox Frontier

Sandwich cliffs, a thermos waterfall, foil mines, a river, and a spoon harbor.

Fishing, panning, flow puzzles, rafting, and traversal belong naturally here.

Explore currents, slopes, shifting cargo, and controlled pouring.

The Claw Cabinet

A transparent city among prizes.

Claws, conveyor streets, magnetic objects, movable cover, and machinery create activities from several perspectives.

A player might operate the machine, live inside it, or coordinate its systems with another player.

World design test

For every selected attraction, explain what players can do because of the world’s defining behavior.

If the setting contributes only scenery, strengthen the connection or choose a better setting.

Let one distinctive physical rule recur in several attractions without making them feel identical.

Treat all names as provisional.

---

## 11. Session formats must remain coherent

Build toward the following formats, in an order justified by the first playable experience.

Party Tour

Individual standings with:

* Free-for-all attractions.
* Temporary partnerships.
* Carefully scored rotating-role events.
* Consequential board decisions.

Make this a coherent social session before expanding the public competitive structure.

Crew Cup

Stable 2v2 teams using compatible attractions.

Crew identity, team mastery, and later crew competition can grow from this foundation.

Do not force incompatible rotating roles into a fixed-team scoreboard.

Duet Adventure

A complete two-player experience.

Support cooperation and selected head-to-head challenges without requiring strangers or pretending that every four-player attraction scales automatically.

A couple or parent-child pair must have a satisfying session with meaningful roles for both people.

Quick Play

One attraction, immediate practice, clear invitations, and rapid retry.

Solo Challenges

Authored challenges, skill development, time trials, and appropriate verified ghosts.

Solo play should teach useful mastery and remain enjoyable in its own right.

Three-versus-one rules

Before implementing a 3v1 attraction, define the entire role block.

Specify:

* How everyone receives the solo role.
* Comparable conditions.
* Round length.
* Per-role scoring.
* Conversion into tour points.
* The effect of role order and learning.
* What happens when someone disconnects.
* Whether a partial role block remains competitively valid.

Keep capture consequences short and readable.

Use rescue or limited helper roles where they improve involvement. Prevent permanent stun, spawn trapping, endless rescue loops, and helpers that remove the solo player’s agency.

Scoring integrity

Each attraction has its own raw result.

Translate results into tour or cup scoring through clear rules. Do not compare raw fish counts directly with rhythm points or platforming distance.

Specify ties, overtime, forfeits, assists, disconnects, and unfinished rounds.

Produce a complete sample tour with named players, temporary teams, an asymmetric role block, and final standings. Explain every awarded point.

Identify advantages introduced by teammates, role order, or conditions. Casual party standings are not automatically a trustworthy measure of individual competitive skill.

---

## 12. Difficulty, accessibility, and mixed-skill play

Create an inviting first action and a meaningful skill ceiling.

Difficulty can come from:

* More consequential choices.
* Optional difficult routes.
* Target motion.
* Timing.
* Spatial prediction.
* Team coordination.
* Resource tradeoffs.
* Recovery decisions.
* Greater consistency under pressure.

Avoid relying primarily on hand endurance, obscure instructions, or tiny touch targets.

For rapid-input activities, investigate rhythm, pressure, venting, timing, and risk decisions.

Offer appropriate hold, toggle, or alternative inputs. Validate their fairness before combining results in competitive rankings.

Provide:

* Touch alternatives to motion input.
* Adjustable control placement where useful.
* Left-handed options where relevant.
* Readable text and clear contrast.
* Cues beyond color alone.
* Reduced motion.
* Adjustable haptics and audio.
* Clear recovery after mistakes.
* Short playable explanations.

Private groups can choose assists and difficulty openly.

Avoid silent handicaps that undermine trust in the result.

A novice should have an enjoyable contribution. An expert should have room to express mastery.

Test whether an adult and child, a skilled player and beginner, or two equally experienced friends can each find a satisfying relationship to the same attraction.

---

## 13. Make the controls and feedback exceptional

Treat physical feel as a central production discipline.

For each important action, refine:

* Input recognition.
* Anticipation.
* Response timing.
* Acceleration and deceleration.
* Contact.
* Weight.
* Follow-through.
* Recovery.
* Camera behavior.
* Sound.
* Animation.
* Haptics.
* Success and failure feedback.

Measure and observe before adding effects.

Use visual exaggeration to improve comprehension and personality while keeping gameplay outcomes predictable.

Separate cosmetic reactions from authoritative competitive state where appropriate.

Examples:

* A character can tumble comically after a resolved collision without letting cosmetic ragdoll behavior determine an unfair result.
* A claw can visibly compress around a prize while the capture rule remains understandable.
* A catapult can have satisfying elastic anticipation without delaying input unpredictably.
* A fishing line can communicate tension through shape, sound, and character posture.
* A balloon can show pressure through form and motion before failure.

Keep the camera useful.

Players must be able to see the next meaningful decision, judge contact, and understand what happened.

Avoid effects that hide hazards, obscure opponents, or make a small phone screen difficult to read.

Use audiovisual polish to reinforce the mechanic.

---

## 14. Design a short, welcoming social flow

The home experience should quickly communicate:

* Play Together
* My Characters
* My Worlds

Joining a friend should place the player in the correct party with a usable character already selected.

Personalization must not delay the first match.

Design the complete journey:

1. Open an invitation.
2. Reach the intended party.
3. Select or accept a character.
4. Understand the session.
5. Learn the next action through a brief playable explanation.
6. Play.
7. Understand the result.
8. Continue or rematch with the group intact.

Define the awkward cases:

* An invitation has expired.
* A party is full.
* A world is still downloading.
* A character asset fails.
* A player disconnects.
* A host leaves.
* A purchase entitlement has not synchronized.
* Someone wants to leave while others continue.

Preserve momentum and dignity in those situations.

Use expressive emotes and preset communication initially. Any public text or voice communication requires an appropriate account, moderation, and reporting design.

End sessions clearly. Make rematch easy. Let people leave without punishment.

---

## 15. Build the complete personalized-avatar system

Personalized characters are a major product promise.

Aim for coherent comic realism:

* Recognizable features.
* Appealing proportions.
* Selective exaggeration.
* Believable materials.
* Expressive movement.
* Strong silhouettes.
* Consistent lighting and presentation.
* Readability at gameplay scale.

Player flow

Choose person, dog, or cat → select reference → understand processing → preview → adjust → approve → play.

Keep free built-in characters and a useful manual builder available throughout.

Evaluate implementation approaches

Investigate:

* Approved human, dog, and cat templates with personalized features and materials.
* More freely generated geometry.
* Hybrid approaches that preserve reliable bodies and animation while allowing distinctive likeness.

Compare them using actual examples.

Measure:

* Recognition.
* Appeal.
* Consistency.
* Animation stability.
* Required manual repair.
* Generation cost.
* Failure rate.
* Mobile performance.
* Time to an accepted result.

Choose the strongest practical approach and preserve a path to improve it.

A playable avatar is more than a portrait

The full pipeline must address:

1. Reference suitability.
2. Likeness interpretation.
3. Art-direction consistency.
4. Mesh or template adaptation.
5. Materials and textures.
6. Rigging.
7. Required animations.
8. Attachments and vehicle fit.
9. Optimization.
10. Engine import.
11. Gameplay validation.
12. Approval and storage.
13. Replacement and deletion.

Humans, dogs, and cats need appropriate rigs and action adaptations.

Pets might use mouth carries, harnesses, seats, paw controls, or playful tool attachments.

If an upright mascot treatment proves stronger, present it as a deliberate artistic option and evaluate recognition and appeal. Do not silently force quadrupeds through unsuitable human animations.

Approval must show the actual result

Show the character:

* Rotating.
* Moving.
* Jumping or performing its equivalent locomotion action.
* Interacting with an object.
* Entering a vehicle or apparatus.
* Celebrating.
* Appearing from the gameplay camera.

Check clipping, missing geometry, attachments, silhouette, collision, loading, and performance.

Cosmetic height, species, fur, clothing, and body shape must not purchase reach, speed, collision advantages, or reduced visibility.

Preserve the previous approved character until the replacement passes acceptance.

Keep generation outside live gameplay

Use asynchronous jobs, bounded retries, validation, durable asset storage, and clear failure states.

Cache approved assets. Loading a match or changing an outfit must not regenerate the character.

Do not rely on temporary provider download URLs as permanent game assets.

Keep provider integrations replaceable.

References and personal data

Use original synthetic sample characters during development unless authorized references are explicitly supplied for this purpose.

Do not search accounts for photos or send real reference images to an unapproved processor.

Before production use, verify the selected provider’s:

* Commercial terms.
* Image eligibility.
* API capabilities.
* Output rights.
* Training policy.
* Retention and deletion behavior.
* Pricing and service limits.

Explain the recipient and purpose before upload and obtain the appropriate permission.

Use minimal photo access. Remove unnecessary metadata. Keep original references private and out of public asset paths and logs.

Separate:

* Original references.
* Approved playable avatars.
* Public profile visibility.
* Replay and sharing permissions.

For children, design the actual parent-managed account and consent flow required by the intended audience and regions. A purchase gate alone does not establish permission to process a child’s photo.

Represent deletion and retention honestly.

---

## 16. Establish an original visual and audio identity

Explore an art direction that combines:

* The warmth and immediacy of a memorable arcade game.
* The tactile detail of miniature physical objects.
* Expressive comic characters.
* Clean modern presentation.
* Readable competition.

Create a concise art bible covering:

* Character proportions.
* Materials.
* Palette relationships.
* Lighting.
* Camera language.
* Environmental scale.
* UI typography.
* Iconography.
* Animation exaggeration.
* Effects.
* Sound and musical motifs.

Maintain coherence between personalized characters and authored characters.

The game should feel like one world of possibilities.

Make each miniature setting recognizable from a short clip or a single gameplay view.

Develop sound as functional feedback as well as atmosphere:

* Tension before release.
* Contact and weight.
* Successful cooperation.
* Pressure changes.
* Approaching hazards.
* Clear scoring events.
* Character reactions.

Use original or properly licensed assets and maintain a clear asset record.

Prioritize the player’s ability to perceive and act.

---

## 17. Engineer multiplayer around actual gameplay requirements

Build private online play for small groups as a primary capability.

Choose an authority model appropriate to the selected stack and release stage.

Define ownership of:

* Player inputs.
* Movement.
* Shared physical objects.
* Captures.
* Projectiles.
* Role assignment.
* Scoring.
* Round transitions.
* Board choices.
* Entitlements.
* Leaderboard submissions.

Do not assume every attraction needs identical synchronization.

Examples:

* Shared physics requires a coherent authority and reconciliation strategy.
* Launching requires validation of release conditions and outcomes.
* Rhythm games should not reward lower packet-arrival delay.
* Fishing can use validated actions and controlled state.
* Board decisions need reliable ordering and agreement.

Use prediction, interpolation, reconciliation, and lag handling where they improve the experience.

Do not assume physics will be deterministic across devices.

Keep model inference and avatar generation outside latency-sensitive gameplay.

Failure recovery

Specify and test:

* Joining.
* Late joining, where allowed.
* Ready states.
* Reconnection.
* Host departure.
* Temporary network loss.
* Asset mismatch.
* Version mismatch.
* Incomplete role rotations.
* Duplicate result submissions.
* Rematch.
* Session termination.

Label bots and ghosts honestly.

A local simulation is useful evidence for some questions. It is not proof of real online play.

Competitive results

Trusted rankings need an appropriate result-validation approach.

Client-supplied scores alone are insufficient for serious competitive claims.

Create comparable categories where differences in rules, assists, modes, or equipment would invalidate direct comparisons.

Build toward friend, national, and world standings. Use a selected country or region when sufficient; avoid unnecessary precise location collection.

Keep the public population together. Introduce public queues when the audience and operations can support them.

---

## 18. Preserve the golf opportunity without derailing the new game

Earlier Sway, SwayGolf, BounceBack, and FairwayFinder ambitions included:

* Interactive golf.
* Head-to-head play.
* Scrambles.
* Skins.
* Solo challenges.
* Multiplayer competition.
* National and world leaderboards.

Preserve those ideas as a possible future golf world or a separate later product decision.

Use game points for the proposed skins format.

Do not turn this project into a golf-only application or make a full golf simulation a prerequisite for the party game.

Retain useful architectural opportunities, such as reusable identity, private groups, competition formats, and verified results, without building speculative infrastructure solely for a distant product.

---

## 19. Make content expansion repeatable

Design a world package that can contain:

* Board rules.
* Arena geometry.
* Compatible attraction definitions.
* Physical behaviors.
* Assets and materials.
* Audio.
* Tutorial cues.
* Camera settings.
* Performance budgets.
* Accessibility information.
* Validation requirements.
* Version information.

Prefer authored worlds and bounded procedural variation initially.

Use procedural systems for understandable combinations that can be validated.

Before allowing public creator tools or AI-generated playable worlds, define:

* Allowed content.
* Playability checks.
* Performance limits.
* Compatibility.
* Moderation.
* Reporting.
* Versioning.
* Discovery.
* Content delivery.
* Failure recovery.

Prove the expansion process by building a second mechanically distinct world.

Measure the effort and cost before promising a release cadence.

---

## 20. Build a fair commercial model

The proposed business foundation is:

* A complete and enjoyable free core.
* Personal avatar creation.
* Exact cosmetic purchases.
* Substantial world-hosting packs.
* Meaningful expansions.

A host who owns an additional world should be able to invite guests into it.

Keep public competitive access and equipment fair.

Sell clear value

Possible products include:

* One approved personalized avatar with a defined revision allowance.
* A household or people-and-pets character pack.
* Exact outfits and vehicle appearances.
* Celebrations, sound packs, and decorations.
* A complete additional world.
* A substantial seasonal expansion.

Display clear local-currency prices, contents, and ownership rules.

Technical generation failures should not consume creative revision credits.

Keep generation attempts bounded.

Preserve competition

Vehicle classes may have balanced mechanical tradeoffs when available fairly.

Paid appearances must not grant superior speed, strength, handling, reach, cooldowns, or win probability.

Match-earned boosts can create strategic choices.

Claw grabs, fishing, panning, and treasure collecting are skill activities. Do not convert them into paid random pulls, purchased odds, or paid near-miss retries.

Keep the shop away from the loss-to-rematch path.

Implement the applicable platform purchasing, entitlement, restoration, and refund behavior before enabling real sales.

Measure the business

Calculate cost per accepted avatar from:

* Previews.
* Generation attempts.
* Rigging and validation.
* Moderation.
* Expected support.
* Storage.
* Delivery.

Model:

* Session hosting.
* Monitoring.
* Maintenance.
* Content production.
* Platform charges.
* Customer support.

Use clearly labeled assumptions and measured costs.

Do not invent revenue forecasts or willingness to pay.

---

## 21. Design for voluntary replay and organic discovery

Create return value through:

* Skill development.
* Shared laughter.
* Recognizable characters.
* New worlds.
* Meaningful challenges.
* Friendly rivalry.
* Cooperation.
* Expressive customization.

Avoid coercive streak loss, shame, misleading scarcity, or pressure aimed at children.

Design shareable moments into actual gameplay.

Examples:

* A pet’s improbable landing.
* A coordinated rescue.
* A clever board choice becoming useful.
* A giant friend missing an obvious claw grab.
* A risky shortcut succeeding.
* A beautifully executed team handoff.

Offer optional replay or clip capture when the implementation can support it.

Exclude raw reference photos, real names, and private invitation codes from exports by default. Apply appropriate child-sharing restrictions.

Choose a replay approach that fits the simulation. Do not assume replaying inputs will faithfully reconstruct nondeterministic physics.

Use truthful gameplay in promotional material.

Never fabricate reviews, player counts, rankings, testimonials, or gameplay.

Test discovery hypotheses separately:

1. Recognizable people and pets.
2. Impossible little worlds.
3. Cooperative ingenuity.
4. Visible skill and rivalry.

Measure invitation completion, time to shared play, voluntary rematches, group return, and invitations to additional players.

Treat a small pilot as learning. Distinguish politeness from behavior.

---

## 22. Own the project coherently

Use the repository as the source of truth.

Preserve unrelated user work. Use an isolated branch or worktree when appropriate. Do not discard uncommitted changes.

Create a clean project when none exists.

Choose the engine and services after inspecting actual constraints. Unity is a strong starting candidate for this direction; justify an alternative through the project’s needs and available tooling.

Prefer maintainable solutions that support iteration.

Avoid premature microservices, speculative abstractions, unnecessary dependencies, and custom systems where a reliable existing capability serves the game well.

Keep durable project records proportional to the stage:

* A concise project instruction file.
* The master brief.
* A living game design document.
* A decision record.
* An attraction registry.
* A progress and acceptance record.
* Run and build instructions.
* A short list of unresolved dependencies.

Keep the project instruction file concise. Use it to point to authoritative documents and preserve critical rules.

Do not create several conflicting versions of the product plan across disconnected conversations.

Use parallel work selectively

Delegate independent work when it improves results.

Good candidates include:

* Reviewing scoring fairness.
* Auditing networking assumptions.
* Evaluating avatar integration.
* Inspecting accessibility.
* Reviewing a contained implementation.
* Researching a specific provider capability.

Give each delegated task a clear output, scope, and owner.

Integrate the results into one coherent project.

Avoid multiple agents making conflicting architectural changes or editing the same files without coordination.

Ultracode or other workflow orchestration may be useful for bounded reviews. Do not enable expensive orchestration indiscriminately merely because the project is ambitious.

Respect practical boundaries

Proceed with authorized, reversible local work and routine decisions.

Respect current permissions, credentials, and budgets.

Obtain required authorization before new spending, public deployment, external outreach, or sending actual personal photos to a new processor.

Complete all useful preparatory work before requesting a consequential decision.

Do not use this brief to bypass access controls or existing approval requirements.

---

## 23. Build in evidence-driven stages

Stage A — Find the first exceptional interaction

Recommend the identity and central loop briefly.

Expose the largest assumptions.

Build one memorable interaction with a complete beginning, middle, and finish.

Suggested starting candidate: Catapult Courier.

Use functional placeholders where useful, but make the controls, camera, scoring, and retry loop real.

Evaluate whether the interaction supports both immediate amusement and improvement through practice.

Stage B — Prove meaningful variety

Add two contrasting attractions.

Suggested candidates:

* Zipper Sprint for movement and readable momentum.
* Clawful Company for scale and asymmetric interaction.

Replace these if a stronger trio emerges.

Use a small mechanic laboratory before committing to the final production world.

Extract shared systems from the working examples.

Stage C — Complete one coherent tour

Choose the strongest connected attractions and a world that supports them.

Build:

* Usable characters.
* Real party joining.
* Brief instructions.
* A meaningful board choice.
* Complete rounds.
* Clear scoring.
* Transitions.
* A satisfying ending.
* Rematch with the group intact.

A small finished session should demonstrate the larger promise.

Stage D — Prove personalization

Validate representative human, dog, and cat characters through actual gameplay.

Integrate production photo processing only when capability, permissions, cost, and data handling are ready.

Missing photos or paid generation access must not block the playable game.

Stage E — Observe real groups

Prepare a playable build and a concise observation plan.

Test with friends, couples, and parent-managed family sessions as appropriate.

Watch:

* Where people hesitate.
* Whether they understand the cause of outcomes.
* Whether both players contribute.
* What makes them laugh.
* What frustrates them.
* Whether they voluntarily retry.
* Whether they return or invite others.

Do not invent these observations or arrange external outreach without authorization.

Stage F — Prepare a release candidate

When evidence supports the core, complete the necessary:

* Initial content.
* Device testing.
* Online reliability.
* Commerce.
* Account and privacy behavior.
* Moderation and reporting.
* Production hosting.
* Support workflow.
* Platform requirements.
* Release assets.

Stage G — Prove expansion

Produce a second distinct world through the content pipeline.

Measure what is reusable, what requires new work, and whether the economics support the intended cadence.

These stages are progress gates. Estimate effort using explicit assumptions and actual dependencies.

---

## 24. Establish meaningful technical budgets

Choose representative target devices and connection conditions.

Define and measure appropriate budgets for:

* Frame time.
* Input responsiveness.
* Memory.
* Asset size.
* Download size.
* Scene transitions.
* Network traffic.
* Session hosting.
* Battery and thermal behavior.
* Avatar generation and delivery.
* Error recovery.

Set targets that support the intended experience, then report actual measurements.

A smooth empty scene does not establish representative gameplay performance.

Profile scenes containing realistic characters, effects, shared objects, and multiplayer behavior.

Use suitable asset optimization, material limits, animation budgets, level of detail, and loading strategies.

Do not invent measurements when hardware or tooling is unavailable. Provide the exact remaining test procedure.

---

## 25. Validate the right things

Use tests where they protect meaningful behavior.

Examples include:

* Score conversion.
* Role rotation.
* Tie resolution.
* Session transitions.
* Duplicate result handling.
* Entitlement restoration.
* Avatar fallback.
* Reconnection.
* Content compatibility.
* Resource accounting.
* Input validation.

Use engine and integration tests where appropriate.

Use visual and interactive inspection for:

* Camera framing.
* Touch usability.
* Animation quality.
* Character clipping.
* Physical feedback.
* Tutorial clarity.
* World readability.
* Transitions.
* Mobile presentation.

Use real players for social fun and comprehension.

Stop repeating tests that no longer resolve a concrete uncertainty.

Fix observed problems, rerun the relevant checks, and move toward the playable milestone.

---

## 26. Report evidence precisely

Use these status categories:

* Implemented and tested.
* Implemented but untested.
* Simulated.
* Mocked.
* Proposed.
* Blocked by a named dependency.

Do not call concept art a playable avatar.

Do not call a local simulation verified online multiplayer.

Do not call a web demonstration a native iOS build.

Reserve “verified four-player online play” for four real participants on separate connected devices completing the relevant session.

Automated multi-client tests are useful and should be reported as their own evidence.

For every milestone, state:

* What exists.
* How to run it.
* What was observed.
* What passed.
* What failed.
* What changed after testing.
* What remains uncertain.
* The next concrete action.

Do not invent retention, revenue, player reactions, performance numbers, or test results.

Replace flattering self-ratings with evidence.

---

## 27. Use five review disciplines

Use these as a critique loop. Invoke named plugins only if they are actually available; otherwise perform the corresponding discipline.

The Mode Maker

* Is the central action enjoyable?
* Where are the meaningful choice, skill, counterplay, and social tension?
* Does the variation add depth?
* What should be removed or replaced?
* Is the attraction distinctive beyond its name and scenery?

BounceBack UXBoard

* Can someone join and understand the next action?
* Are controls, roles, scoring, recovery, and rematch clear?
* What does a parent-child pair experience?
* What does a remote couple experience?
* Where does the interface interrupt play unnecessarily?

BounceBack CreatorKit

* What actual moment would someone show a friend?
* Does the world communicate quickly?
* Does personalization amplify the game?
* Can a truthful clip make someone want to join?
* Is the identity recognizable across different attractions?

BounceBack Engineer

* Does it run, synchronize, recover, animate, and perform?
* Are abstractions justified by working examples?
* Which capabilities still lack evidence?
* Are failures handled coherently?
* Is the next milestone genuinely executable?

Chris Money Maker

* What optional purchase provides clear value?
* Can free friends play together?
* Are avatar and session costs sustainable?
* Does the shop preserve trust and fairness?
* Which commercial assumptions need measurement?

Resolve disagreements into one product decision.

Do not deliver five disconnected plans.

---

## 28. Creative seed bank: 35 attractions

These are starting points.

Improve, combine, replace, or postpone them.

Wild-card events are optional variants. The base activity must work first. Use visible cues and counterplay.

For every attraction selected for implementation, define player count, teams, controls, timing, raw scoring, tour conversion, ties, accessibility, network authority, disconnect behavior, animation needs, and acceptance criteria.

On foot, balance, and coordination

🎮 [FORMAT] 1. Zipper Sprint — 1v1 or 2v2 obstacle chase. [GOAL] Outrun a closing giant zipper, choosing safe fabric folds or risky tooth-to-tooth jumps. [SCORING] First complete team across; otherwise checkpoint progress. [WILD CARD EVENT] A loose button rolls across branching routes. ⚡️

🎮 [FORMAT] 2. Shadow Step — two-player cooperation. [GOAL] One player aims a flashlight revealing safe platforms while the other crosses, then roles swap. [SCORING] Combined completion time with clear fall penalties. [WILD CARD EVENT] A hanging object changes the revealed shadows. ⚡️

🎮 [FORMAT] 3. Loose Change — individual risk-and-reward platforming. [GOAL] Collect couch coins and decide when to bank them before a heavier load makes the return harder. [SCORING] Banked coins. [WILD CARD EVENT] A compressing cushion opens a new return route. ⚡️

🎮 [FORMAT] 4. Sockrope — paired traversal. [GOAL] Use a stretchy sock tether, counterweights, and alternating jumps to cross a laundry canyon. [SCORING] Furthest shared checkpoint, then time. [WILD CARD EVENT] A rotating clothes peg becomes a temporary anchor. ⚡️

🎮 [FORMAT] 5. Button Borough — 1v1 or 2v2 route puzzle. [GOAL] Carry deliveries through paths changed by giant floor buttons. [SCORING] Completed deliveries; blocking alone scores nothing. [WILD CARD EVENT] An announced button briefly controls a different junction. ⚡️

🎮 [FORMAT] 6. Leapfrog Ladder — cooperative vertical race. [GOAL] Spring from your partner, then help them reach the next ledge. [SCORING] Height of the lower teammate, then completion time. [WILD CARD EVENT] A swinging towel offers an optional shortcut. ⚡️

Vehicles and positioning

🎮 [FORMAT] 7. Crate Expectations — 2v2 cargo control. [GOAL] Coordinate vehicle bumps and bracing to guide your enormous crate through tight turns. [SCORING] First delivered crate; otherwise checkpoint progress. [WILD CARD EVENT] A drawbridge opens an awkward shortcut. ⚡️

🎮 [FORMAT] 8. Garage Tangle — 1v1 or cooperative parking puzzle. [GOAL] Park oddly shaped vehicles without blocking later arrivals. [SCORING] Completed arrangement, then moves and time. [WILD CARD EVENT] A turntable rotates at a published moment. ⚡️

🎮 [FORMAT] 9. Switchback — 2v2 route engineering. [GOAL] Push barriers to open a route for both teammates while closing other lanes. [SCORING] First full team home. [WILD CARD EVENT] A central gate reverses with a countdown. ⚡️

🎮 [FORMAT] 10. Paint the Block — individual or team territory driving. [GOAL] Close loops to claim neighborhoods while protecting unfinished trails. [SCORING] Claimed area at the horn. [WILD CARD EVENT] A moving tram divides the arena into tactical zones. ⚡️

🎮 [FORMAT] 11. Clockwork Convoy — paired delivery. [GOAL] Match a toy train’s movement and guide parcels into the correct wagon while partners retrieve and reposition. [SCORING] Correct deliveries with clear cargo penalties. [WILD CARD EVENT] A track switch changes the approach. ⚡️

🎮 [FORMAT] 12. Balance of Power — 2v2 weight positioning. [GOAL] Drive around a suspended playground to tilt rolling balls into your pockets. [SCORING] Balls captured. [WILD CARD EVENT] A heavier neutral ball changes the platform’s balance. ⚡️

Aiming, claws, stacking, and launching

🎮 [FORMAT] 13. Claw and Effect — simultaneous precision race. [GOAL] Identify requested upgrade shapes and time a swinging claw to extract them from a shared glass bin, then deliver the correct set. [SCORING] Completed orders; wrong items cost time. [WILD CARD EVENT] A marked prize turntable reverses. ⚡️

🎮 [FORMAT] 14. Catapult Courier — two-player cooperation or 2v2 launch-and-catch. [GOAL] Launch your own little self or pet avatar from a spoon while your partner positions the receiving basket, then swap roles. [SCORING] Successful landings with declared route bonuses. [WILD CARD EVENT] A visible fan rotates and changes the wind. ⚡️

🎮 [FORMAT] 15. Bank Job — 1v1 or 2v2 ricochet sport. [GOAL] Send pucks into your vault after touching a marked rebound surface. [SCORING] Legal banked pucks. [WILD CARD EVENT] A central bumper changes orientation. ⚡️

🎮 [FORMAT] 16. Spoon Siege — alternating team construction and launch. [GOAL] Arrange defenses, then launch soft projectiles to ring the opposing bell. [SCORING] Bell hits across equal attacking turns. [WILD CARD EVENT] A neutral rebound panel becomes usable. ⚡️

🎮 [FORMAT] 17. Stack Exchange — competitive or cooperative claw stacking. [GOAL] Build a stable trophy pile from easy pieces and awkward shapes. [SCORING] Stable height at the finish. [WILD CARD EVENT] An announced platform wobble tests the structure. ⚡️

🎮 [FORMAT] 18. Pass the Planet — 2v2 launch relay. [GOAL] Catch and redirect a giant glowing marble through receiving bowls. [SCORING] Completed circuits and clean handoffs. [WILD CARD EVENT] A moving bowl creates a difficult shortcut. ⚡️

Timing, rhythm, and reaction

🎮 [FORMAT] 19. Balloon Bureau — solo race or paired pressure control. [GOAL] Inflate to a target using rhythmic pumps and smart venting, then fit through changing openings without bursting. In pairs, divide pump and valve, then swap. [SCORING] Completed passages, then time. [WILD CARD EVENT] The next gate requires a smaller balloon. ⚡️

🎮 [FORMAT] 20. Echo Gecko — individual or team rhythm memory. [GOAL] Repeat beats, pauses, and character calls. [SCORING] Correct sequences and calibrated timing accuracy. [WILD CARD EVENT] An announced final sequence must be answered in reverse. ⚡️

🎮 [FORMAT] 21. Pendulum Pantry — precision timing. [GOAL] Drop ingredients through swinging shelves into the correct moving bowls. [SCORING] Correct landings with visible difficulty values. [WILD CARD EVENT] A shelf pauses before resuming its displayed motion. ⚡️

🎮 [FORMAT] 22. Signal Scramble — reaction and restraint. [GOAL] Respond to your assigned symbol-and-sound combination while ignoring decoys. [SCORING] Correct responses minus false presses. [WILD CARD EVENT] A visible rule card changes the valid combination. ⚡️

🎮 [FORMAT] 23. Wind-Up Duet — paired synchronization. [GOAL] Wind different halves of a clockwork creature so their rhythms meet on shared beats. [SCORING] Distance with minimal wasted winding. [WILD CARD EVENT] A gear change introduces an announced new rhythm. ⚡️

Fishing, panning, tension, and flow

🎮 [FORMAT] 24. Panning Panic — solo mastery or head-to-head prospecting. [GOAL] Swirl and tip a shallow pan to shed grit while retaining nuggets; faster pours risk losing gold. [SCORING] Gold recovered within equal time. [WILD CARD EVENT] A ripple requires controlled recovery. ⚡️

🎮 [FORMAT] 25. Hook, Line, Thinker — solo or paired fishing. [GOAL] Place a lure, manage tension, and guide a fish around obstacles while a partner can position the net. [SCORING] Landed catch value in equal time. [WILD CARD EVENT] A toy boat changes the landing lane. ⚡️

🎮 [FORMAT] 26. Sluice Architects — 1v1 or 2v2 flow puzzle. [GOAL] Place a limited set of gates to guide treasure into your trough without clogging the shared waterway. [SCORING] Treasure collected. [WILD CARD EVENT] A marked upstream gate releases a larger batch. ⚡️

🎮 [FORMAT] 27. Knot Tonight — paired tension puzzle. [GOAL] Move cord ends around posts to release loops in the right order. [SCORING] Completed knots, then time. [WILD CARD EVENT] A retracting post opens a new solution path. ⚡️

🎮 [FORMAT] 28. Leak Week — cooperative prioritization. [GOAL] Move plugs among leaks while steering a tiny boat toward rescue. [SCORING] Rescue progress, then less water aboard. [WILD CARD EVENT] A signaled wave produces two small leaks. ⚡️

🎮 [FORMAT] 29. Bottle Rapids — solo or paired navigation. [GOAL] Guide a loaded raft through a ship-in-a-bottle using tilt and current gates. [SCORING] Checkpoints with intact cargo. [WILD CARD EVENT] The bottle rolls slowly toward a marked resting position. ⚡️

Rotating 3v1

For these attractions, rotate the solo role across comparable conditions. Define explicit scoring, normalization, and the effect of player-count changes before implementation.

🎮 [FORMAT] 30. Clawful Company — rotating 3v1. [GOAL] One giant character operates a claw while three tiny runners carry prizes to safety. [SCORING] Captures and successful deliveries across equal role rotations. [WILD CARD EVENT] The prize conveyor reverses. ⚡️

🎮 [FORMAT] 31. Couch Kraken — rotating 3v1. [GOAL] The solo player creates visible blanket waves while the trio crosses cushion islands. [SCORING] Captures and escapes across equal role rotations. [WILD CARD EVENT] A rolled blanket creates a temporary bridge. ⚡️

🎮 [FORMAT] 32. Flashlight Fugitives — rotating 3v1 stealth. [GOAL] The solo player scans an attic while runners transport objects between safe zones. [SCORING] Detections and deliveries across equal role rotations. [WILD CARD EVENT] A toy creates moving cover. ⚡️

🎮 [FORMAT] 33. Teaquake — rotating 3v1 balance. [GOAL] One player tilts a tray while the trio delivers sugar cubes into teacups. [SCORING] Deliveries and prevented deliveries across equal role rotations. [WILD CARD EVENT] A teaspoon slides into a new terrain feature. ⚡️

🎮 [FORMAT] 34. Clockwork Warden — rotating 3v1 planning. [GOAL] The solo player queues visible clock-hand movements while the trio finds routes to activate bells. [SCORING] Bells and interrupted attempts across equal role rotations. [WILD CARD EVENT] A previously inactive gear joins the displayed cycle. ⚡️

🎮 [FORMAT] 35. Snowglobe Shakedown — rotating 3v1 escape. [GOAL] The solo player sends bounded gusts while runners gather keys and reach a cabin. [SCORING] Escapes, progress, and captures across equal role rotations. [WILD CARD EVENT] Snow reveals an alternative tunnel. ⚡️

---

## 29. Challenge the catalog creatively

Use the seed bank to discover stronger possibilities.

Explore transformations such as:

* A player becomes the environment’s operator.
* A competitive objective becomes a temporary cooperative necessity.
* An object changes function between rounds.
* A character’s scale changes their role.
* A successful action creates an opportunity another player can exploit.
* One shared physical system gives each player different information or controls.
* A familiar action gains a new spatial or timing relationship.
* A world’s physical behavior creates several distinct activities.
* A failure becomes an interesting recovery decision.
* A strategic choice becomes visibly embodied in the next arena.

Keep the strongest combinations.

Remove ideas that depend on excessive explanation, repetitive input, arbitrary scoring, or visual novelty alone.

For each finalist, answer:

* What is the enjoyable action?
* What is the meaningful decision?
* What can a beginner do successfully?
* What can an expert learn?
* What does another player change?
* What makes the outcome understandable?
* What creates a memorable moment?
* Why would someone voluntarily replay it?

Prototype the answers.

---

## 30. Maintain a high quality bar without losing momentum

Evaluate the playable result across these dimensions:

Identity

Can someone describe the game’s distinctive experience without listing other franchises?

First play

Can a newcomer join a friend and make a meaningful action quickly?

Control

Are input, camera, movement, contact, and recovery predictable and satisfying?

Strategy

Can players understand how their choices influence later action?

Social value

Can two people enjoy a complete session, with both contributing?

Variety

Do attractions feel meaningfully different without constant relearning?

Fairness

Are roles, scoring, accessibility options, purchases, and competition coherent?

Character quality

Do the actual animated characters remain recognizable, appealing, and stable during gameplay?

Reliability

Do joining, reconnecting, fallback, rematch, and entitlements behave correctly?

Performance

Does representative gameplay meet measured device and network budgets?

Replay value

Do people voluntarily rematch, return, practice, and invite others?

Production

Can another distinct world be created through a repeatable process at an acceptable cost?

Find the weakest dimension that materially limits the experience and improve it.

Do not keep polishing an already strong surface while a broken core interaction remains unresolved.

---

## 31. Verify current capabilities through primary sources

Use current official documentation when making decisions about models, tooling, engines, APIs, platform requirements, or service terms.

Useful starting points include:

* Claude Code model configuration⁠￼
* Fable 5.2 prompting guidance⁠￼
* Effort guidance⁠￼
* Claude Code desktop environment⁠￼
* Claude Code workflow orchestration⁠￼
* Tripo rigging documentation⁠￼
* Tripo animation documentation⁠￼
* Meshy animation documentation⁠￼
* Apple App Review Guidelines⁠￼
* FTC children’s privacy implementation guidance⁠￼

These references are starting points, not evidence that any service has been selected, licensed, or integrated.

Research narrowly enough to resolve consequential uncertainty, then return to implementation.

Record the source and date for important capability or policy decisions.

---

## 32. Begin now

Start with:

1. A concise statement of the strongest creative direction.
2. The actual workspace and toolchain findings.
3. The largest uncertainty to test first.
4. Your selected first playable interaction.
5. The immediate implementation work.

Then build.

Do not end at a proposal when the available tools permit a playable result.

Make reasonable assumptions for reversible decisions and record the important ones. Ask only when a missing decision materially blocks useful progress and cannot be responsibly inferred.

Continue until the current milestone is completed or a concrete dependency requires input. Leave a clear checkpoint and exact next action.

Take the ambition seriously. Bring invention, judgment, engineering precision, visual taste, physical sensitivity, and care.

Build something that feels wonderful in the hands, looks unmistakably its own, and gives people a reason to say:

“Come play this with me.”

Begin the work. 💡
