import { GearSimulator } from './GearSimulator.js';

// With type="module", script is deferred so DOM is already ready
const canvas = document.getElementById('canvas');
const simulator = new GearSimulator(canvas);

// Add initial gear
simulator.addGear();