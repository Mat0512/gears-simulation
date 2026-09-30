/**
 * The gear bench's HOW TO USE tour — its copy and its done rules, as data.
 *
 * No THREE and no DOM, so Node can test it and (later) a speech build can read
 * it. `done(state, start)` gets GearSimulator.tourState() now and as it was
 * when the step began, so "the teeth changed" is a comparison, not an event —
 * whichever control changed them counts.
 *
 * Bodies are one line of plain text, naming controls exactly as the panels
 * print them, and verbs that work for a hand, a controller and a mouse alike.
 */
export const GEARS_STEPS = [
    {
        id: 'add',
        aim: 'add-gear',
        heading: 'ADD A SECOND GEAR',
        body: 'Press Add Gear on the controls panel. The new gear drops into the teeth of the first one.',
        done: (s) => s.gears >= 2,
    },
    {
        id: 'play',
        aim: 'play',
        heading: 'SET THEM TURNING',
        body: 'Press Play. Meshed gears must turn together, so one drives the other.',
        done: (s) => s.playing === true,
    },
    {
        id: 'teeth',
        aim: 'teeth',
        heading: 'CHANGE THE TEETH',
        // The trial withholds the spec controls, so this step is left out there
        // rather than sending a learner to a control that only offers.
        needs: 'gears.spec',
        body: 'Pick a gear and use Teeth, minus and plus. Fewer teeth on a gear makes it turn faster than its partner.',
        done: (s, start) => s.teeth !== start.teeth,
    },
    {
        id: 'ratio',
        aim: 'info-panel',
        heading: 'READ THE RATIO',
        body: 'The panel on your right gives the gear ratio and the speed of each gear, worked out from what you built.',
        done: () => true,
    },
];
