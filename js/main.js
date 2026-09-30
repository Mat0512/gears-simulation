import { GearSimulator } from './GearSimulator.js';
import { QuizMode } from './QuizMode.js';
import { captureExamLink, clearExamLink } from './examLink.js';
import { isLocked } from './edition/Edition.js';

// With type="module", script is deferred so DOM is already ready
const canvas = document.getElementById('canvas');
const simulator = new GearSimulator(canvas);
window.sim = simulator;   // for smoke tests, as the other modules do

// Check for quiz mode via URL params
// Reads the exam link and takes it out of the address bar in one step, so the
// next student on a shared headset cannot read the previous one's ids — or
// edit a digit and submit somebody else's exam.
const urlParams = new URLSearchParams(captureExamLink());
const userId = urlParams.get('user_id');
const examId = urlParams.get('exam_id');

// The link is still captured above whatever the edition says — the ids must
// leave the address bar on a shared headset either way. The edition only
// decides whether an exam STARTS: a trial has no backend, and quiz mode would
// take over the scene waiting for a paper that can never arrive.
if (userId && examId && !isLocked('quiz')) {
  // Quiz mode — QuizMode controls the scene
  simulator.quizMode = new QuizMode(simulator, userId, examId);
} else {
  // Normal sandbox mode — add initial gear
  simulator.addGear();
}
