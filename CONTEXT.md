# RoverLab

RoverLab is a planetary exploration sandbox for observing how an autonomous rover responds to mission priorities and a changing environment.

## Language

**Rover**:
The simulated mobile robot that explores the planetary environment and chooses its actions according to its mission and available knowledge.
_Avoid_: Bot, agent

**Mission**:
The combination of a scientific objective and mission instructions supplied by mission control to guide the rover's choices.
_Avoid_: Action, task

**Mission control**:
The user's role in setting mission priorities and introducing environmental events while the rover remains responsible for choosing its actions.
_Avoid_: Pilot

**Observation**:
Information available to the rover from sensing its surroundings at a particular time.
_Avoid_: World truth

**Rover memory**:
Previously acquired observations retained by the rover, which may describe conditions that have since changed.
_Avoid_: Complete world map

**Full-world view**:
An optional debugging view that reveals the environment beyond what the rover has discovered, without changing the rover's observations or memory.
_Avoid_: Rover vision

**Stranded rover**:
A rover that has exhausted its battery away from base and cannot continue moving.
_Avoid_: Software error

**Expedition**:
A bounded exploration run with its own simulated-time budget and results, potentially including multiple trips to base.
_Avoid_: Mission, trip

**Sample**:
Collectible geological material whose properties can be revealed through inspection and whose value depends on the mission.
_Avoid_: Resource, discovery

**Inspection**:
A deliberate examination of a sample that reveals its properties to the rover.
_Avoid_: Collection

**Mission relevance**:
The degree to which a sample's observed properties address the mission's scientific interests.
_Avoid_: Rarity, universal value

**Dust storm**:
A temporary region that reduces the rover's sensor range and increases energy consumption during movement through it. Once detected, its extent and remaining duration are known to the rover.
_Avoid_: Equipment damage

**Scientific objective**:
The selected scientific aim and scoring rubric, fixed for the duration of an expedition.
_Avoid_: Mission instructions

**Mission instructions**:
Preferences that mission control can edit during an expedition to guide how the rover pursues its fixed scientific objective.
_Avoid_: Scientific objective, direct movement command

**Delivered sample**:
A collected sample that has reached base and contributes to the expedition's science score.
_Avoid_: Inspected sample, onboard cargo

**Science score**:
The value of delivered samples according to the scientific objective's fixed rubric.
_Avoid_: Model confidence, mission relevance

**Expedition time**:
The simulated duration available for exploration and related activities, excluding pauses.
_Avoid_: Wall-clock duration

**Baseline controller**:
A fixed rule-based strategy for choosing the rover's actions, used for comparison or explicitly selected continuation after an inference failure.
_Avoid_: TypeSafe decision

**Action**:
A bounded rover activity: explore, inspect, collect, return to base, recharge, or wait, with a concrete target when needed.
_Avoid_: Mission, motor command

**Cargo**:
Collected samples currently aboard the rover and occupying its carrying capacity.
_Avoid_: Delivered samples

**Decision timeline**:
The chronological account of the rover's observations, available actions, returned probabilities, and selected actions at its decision points.
_Avoid_: Reasoning transcript

**Expedition record**:
The saved starting conditions, decisions, events, and results of an expedition, sufficient to inspect and replay it.
_Avoid_: Live expedition

**Replay**:
A reproduction of an expedition using its recorded decisions and events against its original starting conditions.
_Avoid_: Fresh AI run
