import { GearSimulator } from './GearSimulator.js';
import { QuizMode } from './QuizMode.js';

// With type="module", script is deferred so DOM is already ready
const canvas = document.getElementById('canvas');
const simulator = new GearSimulator(canvas);

// Check for quiz mode via URL params
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('user_id');
const examId = urlParams.get('exam_id');

if (userId && examId) {
  // Quiz mode — QuizMode controls the scene
  simulator.quizMode = new QuizMode(simulator, userId, examId);
} else {
  // Normal sandbox mode — add initial gear
  simulator.addGear();
}
