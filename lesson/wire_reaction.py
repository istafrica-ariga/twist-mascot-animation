#!/usr/bin/env python3
"""Wire the in-lesson Reaction state machine into the lesson screen.

    python3 -I lesson/wire_reaction.py <scene.rml>        (edits in place)

Builds the study-buddy model from lesson/IDEA.md. The animations already exist in the file and are
unreferenced; this adds the inputs the app drives and the layer that plays them. Targets
**Artboard 3**, the only artboard carrying the full set.

Two decisions from looking at the takes frame by frame rather than trusting their names:

  * `Frustrated 2` is not a second wince. It is the mascot smiling with a paw raised — a recovery.
    It becomes `go_on`.
  * `Thinking` is the SAME paw-raise pose, just the move into it rather than the hold. Using both
    would show one shape twice, so `Thinking` is left out and there is no `watching` state in v1.
    That also avoids depending on a signal the app may not have (knowing when a child is composing
    an answer rather than idling).

The shape that matters is the chain: **oops always resolves into go_on.** A wrong answer never
ends on the wince, so the child is never left sitting in the bad beat. `Frustrated` holds its
frown to the last frame, so the blend into `go_on` carries the face from frown to smile exactly as
the paw comes up — the recovery comes free from the existing art.

Layer order is load-bearing: Rive composites layers in declaration order, so a layer declared last
wins on any property it animates. Declaring `Reaction` after `Breathing` and the two blink layers
means it takes the body during a reaction and hands it straight back at Idle, with no gating and
no edits to the layers that already work.
"""
import re
import sys

SM_ID = '0:13003'            # "State Machine 1" on Artboard 3
LAYER_NAME = 'Reaction'
BIG_STREAK = 5               # at this many correct in a row, the bigger celebration

ANIM = {
    'Breathing': '0:12663',       # idle
    'Celebration': '0:13016',     # yes
    'Celebration 4': '0:13956',   # yes_big
    'Frustrated': '0:14896',      # oops
    'Frustrated 2': '0:15629',    # go_on
}

path = sys.argv[1]
s = open(path).read()

if f'name="{LAYER_NAME}"' in s:
    sys.exit(f'{LAYER_NAME} layer already wired; nothing to do.')

# Ids are derived from the file, never guessed. A hand-picked "obviously free" block (0:95010)
# turned out to be a live KeyedProperty inside a hand-added animation, so the only safe base is
# above everything already present.
_base = max(int(m) for m in re.findall(r'id="0:(\d+)"', s)) + 1000


def nid(n):
    return f'0:{_base + n}'


IN_CORRECT, IN_WRONG, IN_STREAK = nid(1), nid(2), nid(3)
LAYER = nid(10)
S_IDLE, S_YES, S_YES_BIG, S_OOPS, S_GO_ON = nid(11), nid(12), nid(13), nid(14), nid(15)
S_ENTRY, S_ANY, S_EXIT = nid(16), nid(17), nid(18)

inputs = (
    f'            <StateMachineTrigger name="correct" id="{IN_CORRECT}"/>\n'
    f'            <StateMachineTrigger name="wrong" id="{IN_WRONG}"/>\n'
    f'            <StateMachineNumber name="streak" id="{IN_STREAK}"/>\n'
)

open_tag = f'<StateMachine name="State Machine 1" id="{SM_ID}">\n'
i = s.find(open_tag)
if i == -1:
    sys.exit(f'could not find the state machine {SM_ID}')
s = s[:i + len(open_tag)] + inputs + s[i + len(open_tag):]


def trig(input_id, n):
    return f'                        <TransitionTriggerCondition inputId="{input_id}" id="{nid(n)}"/>\n'


def num(input_id, op, value, n):
    return (f'                        <TransitionNumberCondition inputId="{input_id}" '
            f'opValue="{op}" value="{value}" id="{nid(n)}"/>\n')


layer = f'''            <StateMachineLayer name="{LAYER_NAME}" id="{LAYER}">
                <EntryState x="-300" y="0" id="{S_ENTRY}">
                    <StateTransition stateToId="{S_IDLE}" id="{nid(20)}"/>
                </EntryState>

                <!-- idle: here with you. The same Breathing loop the Breathing layer plays, so
                     handing control back at the end of a reaction is seamless rather than a cut. -->
                <AnimationState animationId="{ANIM['Breathing']}" x="-80" y="0" id="{S_IDLE}"/>

                <!-- yes / yes_big: celebrates WITH the child. Both return to idle when the take
                     finishes rather than on a timer, so the blend out starts exactly on the end
                     of the performance. -->
                <AnimationState animationId="{ANIM['Celebration']}" x="180" y="-120" id="{S_YES}">
                    <StateTransition stateToId="{S_IDLE}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="140" id="{nid(21)}"/>
                </AnimationState>
                <AnimationState animationId="{ANIM['Celebration 4']}" x="180" y="-20" id="{S_YES_BIG}">
                    <StateTransition stateToId="{S_IDLE}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="140" id="{nid(22)}"/>
                </AnimationState>

                <!-- oops -> go_on is a CHAIN, not a choice. The wince always resolves into
                     encouragement, so a wrong answer never ends on the bad beat. No condition on
                     this transition: it fires on completion, every time. -->
                <AnimationState animationId="{ANIM['Frustrated']}" x="180" y="90" id="{S_OOPS}">
                    <StateTransition stateToId="{S_GO_ON}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="160" id="{nid(23)}"/>
                </AnimationState>
                <AnimationState animationId="{ANIM['Frustrated 2']}" x="400" y="90" id="{S_GO_ON}">
                    <StateTransition stateToId="{S_IDLE}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="180" id="{nid(24)}"/>
                </AnimationState>

                <!-- Any State, so a reaction interrupts whatever is playing, including another
                     reaction. This is the one piece of Masko's graph model worth keeping, and the
                     thing its own player cannot do: there a move waits for the clip on screen to
                     end. 70 ms in, fast enough to read as a response to the tap.
                     The streak-gated transition is declared first; its condition is exclusive with
                     the one below, so only one of them can take the trigger. -->
                <AnyState x="-80" y="190" id="{S_ANY}">
                    <StateTransition stateToId="{S_YES_BIG}" duration="70" id="{nid(25)}">
{trig(IN_CORRECT, 30)}{num(IN_STREAK, 'greaterThanOrEqual', BIG_STREAK, 31)}                    </StateTransition>
                    <StateTransition stateToId="{S_YES}" duration="70" id="{nid(26)}">
{trig(IN_CORRECT, 32)}{num(IN_STREAK, 'lessThan', BIG_STREAK, 33)}                    </StateTransition>
                    <StateTransition stateToId="{S_OOPS}" duration="70" id="{nid(27)}">
{trig(IN_WRONG, 34)}                    </StateTransition>
                </AnyState>

                <ExitState x="560" y="0" id="{S_EXIT}"/>
            </StateMachineLayer>
'''

j = s.find(open_tag)
end = s.find('        </StateMachine>', j)
if end == -1:
    sys.exit('could not find the end of the state machine')
s = s[:end] + layer + s[end:]

open(path, 'w').write(s)

print(f'wired {LAYER_NAME} into {SM_ID}, ids from {nid(1)}')
print('  inputs : correct (trigger), wrong (trigger), streak (number)')
print(f'  states : idle, yes, yes_big (streak >= {BIG_STREAK}), oops -> go_on')
print('  chain  : oops always resolves into go_on before returning to idle')
