import { GearSimulator } from './GearSimulator.js';
import { QuizMode } from './QuizMode.js';
import { captureExamLink, clearExamLink } from './examLink.js';

// With type="module", script is deferred so DOM is already ready
const canvas = document.getElementById('canvas');
const simulator = new GearSimulator(canvas);

// Check for quiz mode via URL params
// Reads the exam link and takes it out of the address bar in one step, so the
// next student on a shared headset cannot read the previous one's ids — or
// edit a digit and submit somebody else's exam.
const urlParams = new URLSearchParams(captureExamLink());
const userId = urlParams.get('user_id');
const examId = urlParams.get('exam_id');

if (userId && examId) {
  // Quiz mode — QuizMode controls the scene
  simulator.quizMode = new QuizMode(simulator, userId, examId);
} else {
  // Normal sandbox mode — add initial gear
  simulator.addGear();
}
