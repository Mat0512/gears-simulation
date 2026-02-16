import * as THREE from "three";

const BASE_URL = "http://192.168.102.222:5000/api";
const TIMER_DURATION = 180; // 3 minutes per question
const INPUT_TORQUE = 10; // Base input torque in Nm

export class QuizMode {
  constructor(simulator, userId, examId) {
    this.simulator = simulator;
    this.userId = userId;
    this.examId = examId;

    // Question state
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.scores = []; // { question_id, is_correct }

    // Timer state
    this.timerRemaining = 0;
    this.timerInterval = null;

    // Quiz state
    this.isActive = false;
    this.isSubmitting = false;

    // 3D panels
    this.panels = {
      start: null,
      quiz: null,
      results: null,
      error: null,
    };
  }

  // ==================== LIFECYCLE ====================

  async init() {
    try {
      await this.fetchQuestions();
      this.createStartPanel();
    } catch (error) {
      console.error("Quiz init failed:", error);
      this.createErrorPanel("Failed to Load Questions", error.message);
    }
  }

  dispose() {
    this.stopTimer();
    this.removeQuizPanels();
    this.isActive = false;
  }

  // ==================== API ====================

  async fetchQuestions() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    console.log("fetching")
    try {
      const res = await fetch(
        `${BASE_URL}/questions/exam/${this.examId}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No questions returned for this exam");
      }

      for (const q of data) {
        if (!q.question_id || !q.question_properties_values) {
          throw new Error("Invalid question format");
        }
      }

      this.questions = data;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    }
  }

  async submitScores() {
    this.isSubmitting = true;

    const payload = {
      student_id: parseInt(this.userId),
      exam_id: parseInt(this.examId),
      scores: this.scores,
    };

    try {
      const res = await fetch(`${BASE_URL}/scores/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (error) {
      console.error("Score submission failed:", error);
      return false;
    } finally {
      this.isSubmitting = false;
    }
  }

  // ==================== 3D PANEL CREATION ====================

  createStartPanel() {
    this.removePanel("start");

    const panel = new THREE.Group();
    panel.name = "quizStartPanel";

    // Background
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.45),
      new THREE.MeshBasicMaterial({
        color: 0x0f3460,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    panel.add(bg);

    // Title
    const titleCanvas = this.simulator.createTextCanvas(
      "Gear Quiz", 300, 40, "bold 22px Arial", "#4a90d9"
    );
    const titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.06),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(titleCanvas),
        transparent: true,
      })
    );
    titleMesh.position.set(0, 0.14, 0.01);
    panel.add(titleMesh);

    // Info text
    const infoText = [
      `Exam ID: ${this.examId}`,
      `Questions: ${this.questions.length}`,
      `Time: ${TIMER_DURATION / 60} min per question`,
      "",
      "Build gear trains to match",
      "the target properties.",
    ].join("\n");

    const infoCanvas = this.simulator.createTextCanvas(
      infoText, 280, 150, "13px Arial", "#e8e8e8", true
    );
    const infoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.22),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(infoCanvas),
        transparent: true,
      })
    );
    infoMesh.position.set(0, -0.01, 0.01);
    panel.add(infoMesh);

    // Start button
    const startBtn = this.simulator.create3DButton(
      0.22, 0.06, "Start Quiz", 0x27ae60, () => this.startQuiz()
    );
    startBtn.position.set(0, -0.16, 0.01);
    panel.add(startBtn);

    panel.position.set(0, 1.4, -0.7);
    panel.rotation.x = -Math.PI / 10;
    this.simulator.scene.add(panel);
    this.panels.start = panel;
  }

  createQuizPanel() {
    this.removePanel("quiz");

    const panel = new THREE.Group();
    panel.name = "quizPanel";

    // Background
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.45),
      new THREE.MeshBasicMaterial({
        color: 0x0f3460,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
    );
    panel.add(bg);

    // Question counter
    const counterCanvas = this.simulator.createTextCanvas(
      `Question 1 / ${this.questions.length}`,
      300, 30, "bold 16px Arial", "#4a90d9"
    );
    const counterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.043),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(counterCanvas),
        transparent: true,
      })
    );
    counterMesh.name = "questionCounter";
    counterMesh.position.set(-0.08, 0.13, 0.01);
    panel.add(counterMesh);

    // Timer text
    const timerCanvas = this.simulator.createTextCanvas(
      "3:00", 100, 30, "bold 16px Arial", "#4caf50"
    );
    const timerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.04),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(timerCanvas),
        transparent: true,
      })
    );
    timerMesh.name = "timerText";
    timerMesh.position.set(0.26, 0.13, 0.01);
    panel.add(timerMesh);

    // Timer bar background
    const timerBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.012),
      new THREE.MeshBasicMaterial({ color: 0x1a1a2e })
    );
    timerBarBg.position.set(0, 0.095, 0.01);
    panel.add(timerBarBg);

    // Timer bar fill
    const timerBarFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.012),
      new THREE.MeshBasicMaterial({ color: 0x4caf50 })
    );
    timerBarFill.name = "timerBarFill";
    timerBarFill.position.set(0, 0.095, 0.015);
    panel.add(timerBarFill);

    // Target properties label
    const labelCanvas = this.simulator.createTextCanvas(
      "Target Properties", 250, 25, "bold 14px Arial", "#ff9800"
    );
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.03),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(labelCanvas),
        transparent: true,
      })
    );
    labelMesh.position.set(0, 0.06, 0.01);
    panel.add(labelMesh);

    // Target properties content (placeholder — updated in loadQuestion)
    const targetCanvas = this.simulator.createTextCanvas(
      "", 300, 120, "13px Arial", "#e8e8e8", true
    );
    const targetMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.14),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(targetCanvas),
        transparent: true,
      })
    );
    targetMesh.name = "targetProperties";
    targetMesh.position.set(0, -0.02, 0.01);
    panel.add(targetMesh);

    // Submit button
    const submitBtn = this.simulator.create3DButton(
      0.32, 0.055, "Submit Answer", 0x27ae60, () => this.submitAnswer()
    );
    submitBtn.name = "submitButton";
    submitBtn.position.set(0, -0.13, 0.01);
    panel.add(submitBtn);

    // Feedback indicator (hidden by default, shown after submit)
    const feedbackCanvas = this.simulator.createTextCanvas(
      "", 300, 40, "bold 18px Arial", "#ffffff"
    );
    const feedbackBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.06),
      new THREE.MeshBasicMaterial({
        color: 0x0f3460,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      })
    );
    feedbackBg.name = "feedbackBg";
    feedbackBg.position.set(0, -0.2, 0.01);
    panel.add(feedbackBg);

    const feedbackMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.05),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(feedbackCanvas),
        transparent: true,
      })
    );
    feedbackMesh.name = "feedbackText";
    feedbackMesh.position.set(0, -0.2, 0.015);
    feedbackMesh.visible = false;
    panel.add(feedbackMesh);

    panel.position.set(0.75, 1.8, -0.6);
    panel.rotation.y = -Math.PI / 16;
    this.simulator.scene.add(panel);
    this.panels.quiz = panel;
  }

  createFeedbackPanel(isCorrect) {
    if (!this.panels.quiz) return;

    const color = isCorrect ? 0x27ae60 : 0xf44336;
    const text = isCorrect ? "Correct!" : "Incorrect";

    // Update feedback background color and show it
    const feedbackBg = this.panels.quiz.getObjectByName("feedbackBg");
    if (feedbackBg) {
      feedbackBg.material.color.setHex(color);
      feedbackBg.material.opacity = 0.95;
    }

    // Update feedback text and show it
    const feedbackMesh = this.panels.quiz.getObjectByName("feedbackText");
    if (feedbackMesh) {
      if (feedbackMesh.material.map) feedbackMesh.material.map.dispose();
      const canvas = this.simulator.createTextCanvas(
        text, 300, 40, "bold 18px Arial", "#ffffff"
      );
      feedbackMesh.material.map = new THREE.CanvasTexture(canvas);
      feedbackMesh.material.map.needsUpdate = true;
      feedbackMesh.visible = true;
    }

    // Auto-hide after 1.5 seconds
    setTimeout(() => {
      this.hideFeedback();
    }, 1500);
  }

  hideFeedback() {
    if (!this.panels.quiz) return;

    const feedbackBg = this.panels.quiz.getObjectByName("feedbackBg");
    if (feedbackBg) {
      feedbackBg.material.opacity = 0;
    }

    const feedbackMesh = this.panels.quiz.getObjectByName("feedbackText");
    if (feedbackMesh) {
      feedbackMesh.visible = false;
    }
  }

  createResultsPanel() {
    this.removePanel("results");
    this.removePanel("quiz");

    const correctCount = this.scores.filter((s) => s.is_correct).length;
    const totalCount = this.scores.length;
    const percentage = Math.round((correctCount / totalCount) * 100);

    const panel = new THREE.Group();
    panel.name = "quizResultsPanel";

    // Background
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 0.55),
      new THREE.MeshBasicMaterial({
        color: 0x0f3460,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    panel.add(bg);

    // Title
    const titleCanvas = this.simulator.createTextCanvas(
      "Quiz Complete", 300, 40, "bold 22px Arial", "#4a90d9"
    );
    const titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.06),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(titleCanvas),
        transparent: true,
      })
    );
    titleMesh.position.set(0, 0.2, 0.01);
    panel.add(titleMesh);

    // Score
    const scoreColor =
      percentage >= 70 ? "#4caf50" : percentage >= 40 ? "#ff9800" : "#f44336";
    const scoreCanvas = this.simulator.createTextCanvas(
      `${percentage}%`, 200, 60, "bold 36px Arial", scoreColor
    );
    const scoreMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.09),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(scoreCanvas),
        transparent: true,
      })
    );
    scoreMesh.position.set(0, 0.1, 0.01);
    panel.add(scoreMesh);

    // Breakdown
    const subtitleCanvas = this.simulator.createTextCanvas(
      `${correctCount} of ${totalCount} correct`,
      250, 25, "14px Arial", "#e8e8e8"
    );
    const subtitleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.03),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(subtitleCanvas),
        transparent: true,
      })
    );
    subtitleMesh.position.set(0, 0.04, 0.01);
    panel.add(subtitleMesh);

    // Per-question breakdown
    const breakdownLines = this.scores.map((s, i) => {
      const icon = s.is_correct ? "[O]" : "[X]";
      return `Q${i + 1}: ${icon}`;
    });
    const breakdownText = breakdownLines.join("\n");

    const breakdownCanvas = this.simulator.createTextCanvas(
      breakdownText, 280, 120, "13px Arial", "#e8e8e8", true
    );
    const breakdownMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.15),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(breakdownCanvas),
        transparent: true,
      })
    );
    breakdownMesh.position.set(0, -0.06, 0.01);
    panel.add(breakdownMesh);

    // Submission status
    const statusCanvas = this.simulator.createTextCanvas(
      "Submitting scores...", 250, 25, "12px Arial", "#aaaaaa"
    );
    const statusMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.03),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(statusCanvas),
        transparent: true,
      })
    );
    statusMesh.name = "submitStatus";
    statusMesh.position.set(0, -0.17, 0.01);
    panel.add(statusMesh);

    // Exit button
    const exitBtn = this.simulator.create3DButton(
      0.2, 0.05, "Exit Quiz", 0x4a90d9, () => this.dispose()
    );
    exitBtn.position.set(0, -0.23, 0.01);
    panel.add(exitBtn);

    panel.position.set(0, 1.4, -0.8);
    this.simulator.scene.add(panel);
    this.panels.results = panel;

    // Submit scores and update status
    this.submitScores().then((success) => {
      this.updateSubmitStatus(success);
    });
  }

  createErrorPanel(title, message) {
    this.removePanel("error");

    const panel = new THREE.Group();
    panel.name = "quizErrorPanel";

    // Red-tinted background
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.3),
      new THREE.MeshBasicMaterial({
        color: 0x3d1010,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    panel.add(bg);

    // Title
    const titleCanvas = this.simulator.createTextCanvas(
      title, 280, 35, "bold 16px Arial", "#f44336"
    );
    const titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.05),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(titleCanvas),
        transparent: true,
      })
    );
    titleMesh.position.set(0, 0.08, 0.01);
    panel.add(titleMesh);

    // Error message
    const msgCanvas = this.simulator.createTextCanvas(
      message, 280, 60, "12px Arial", "#e8e8e8", true
    );
    const msgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.08),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(msgCanvas),
        transparent: true,
      })
    );
    msgMesh.position.set(0, 0, 0.01);
    panel.add(msgMesh);

    // Retry button
    const retryBtn = this.simulator.create3DButton(
      0.15, 0.05, "Retry", 0xff9800, () => {
        this.removePanel("error");
        this.init();
      }
    );
    retryBtn.position.set(0, -0.1, 0.01);
    panel.add(retryBtn);

    panel.position.set(0, 1.4, -0.8);
    this.simulator.scene.add(panel);
    this.panels.error = panel;
  }

  // ==================== PANEL UPDATES ====================

  updateUI() {
    if (!this.isActive) return;
    this.updateTimerDisplay();
  }

  updateTimerDisplay() {
    if (!this.panels.quiz) return;

    // Update timer text
    const timerMesh = this.panels.quiz.getObjectByName("timerText");
    if (timerMesh) {
      const mins = Math.floor(this.timerRemaining / 60);
      const secs = this.timerRemaining % 60;
      const text = `${mins}:${secs.toString().padStart(2, "0")}`;

      const pct = this.timerRemaining / TIMER_DURATION;
      const color = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#ff9800" : "#f44336";

      if (timerMesh.material.map) timerMesh.material.map.dispose();
      const canvas = this.simulator.createTextCanvas(
        text, 100, 30, "bold 16px Arial", color
      );
      timerMesh.material.map = new THREE.CanvasTexture(canvas);
      timerMesh.material.map.needsUpdate = true;
    }

    // Update timer bar
    const timerBarFill = this.panels.quiz.getObjectByName("timerBarFill");
    if (timerBarFill) {
      const pct = this.timerRemaining / TIMER_DURATION;
      timerBarFill.scale.x = Math.max(pct, 0.001);
      timerBarFill.position.x = -0.3 * (1 - pct);

      // Update bar color
      if (pct > 0.5) {
        timerBarFill.material.color.setHex(0x4caf50);
      } else if (pct > 0.25) {
        timerBarFill.material.color.setHex(0xff9800);
      } else {
        timerBarFill.material.color.setHex(0xf44336);
      }
    }
  }

  updateQuestionDisplay() {
    if (!this.panels.quiz) return;

    const question = this.getCurrentQuestion();
    if (!question) return;
    const props = question.question_properties_values;

    // Update counter
    const counterMesh = this.panels.quiz.getObjectByName("questionCounter");
    if (counterMesh) {
      if (counterMesh.material.map) counterMesh.material.map.dispose();
      const canvas = this.simulator.createTextCanvas(
        `Question ${this.currentQuestionIndex + 1} / ${this.questions.length}`,
        300, 30, "bold 16px Arial", "#4a90d9"
      );
      counterMesh.material.map = new THREE.CanvasTexture(canvas);
      counterMesh.material.map.needsUpdate = true;
    }

    // Update target properties
    const targetMesh = this.panels.quiz.getObjectByName("targetProperties");
    if (targetMesh) {
      let lines;
      if (props.type) {
        lines = this.getTypeDisplayLines(props);
      } else {
        lines = [];
        if (props.rpm) lines.push(`Output RPM: ${props.rpm}`);
        if (props.module) lines.push(`Module: ${props.module}`);
        if (props.gearRatio) lines.push(`Gear Ratio: ${props.gearRatio}`);
        if (props.noOfGears) lines.push(`No. of Gears: ${props.noOfGears}`);
        if (props.noOfTeeth) lines.push(`Driver Teeth: ${props.noOfTeeth}`);
      }

      if (targetMesh.material.map) targetMesh.material.map.dispose();
      const canvas = this.simulator.createTextCanvas(
        lines.join("\n"), 300, 120, "14px Arial", "#e8e8e8", true
      );
      targetMesh.material.map = new THREE.CanvasTexture(canvas);
      targetMesh.material.map.needsUpdate = true;
    }
  }

  updateSubmitStatus(success) {
    if (!this.panels.results) return;

    const statusMesh = this.panels.results.getObjectByName("submitStatus");
    if (!statusMesh) return;

    const text = success ? "Scores submitted!" : "Submission failed - retrying...";
    const color = success ? "#4caf50" : "#f44336";

    if (statusMesh.material.map) statusMesh.material.map.dispose();
    const canvas = this.simulator.createTextCanvas(
      text, 250, 25, "12px Arial", color
    );
    statusMesh.material.map = new THREE.CanvasTexture(canvas);
    statusMesh.material.map.needsUpdate = true;

    // Retry on failure
    if (!success) {
      setTimeout(() => {
        this.submitScores().then((retrySuccess) => {
          this.updateSubmitStatus(retrySuccess);
        });
      }, 3000);
    }
  }

  // ==================== BUTTON COLLECTION ====================

  collectButtons(buttonsArray) {
    for (const key in this.panels) {
      const panel = this.panels[key];
      if (!panel) continue;
      panel.traverse((child) => {
        if (child.userData.isButton) {
          buttonsArray.push(child);
        }
      });
    }
  }

  // ==================== QUIZ FLOW ====================

  startQuiz() {
    this.removePanel("start");
    this.isActive = true;
    this.currentQuestionIndex = 0;
    this.scores = [];
    this.createQuizPanel();
    this.loadQuestion(0);
  }

  loadQuestion(index) {
    this.currentQuestionIndex = index;

    // Hide any previous feedback
    this.hideFeedback();

    // Reset scene and add one driver gear
    this.simulator.resetScene();
    this.simulator.addGear();

    // Update the question display
    this.updateQuestionDisplay();

    // Start timer
    this.startTimer();
  }

  submitAnswer() {
    if (!this.isActive) return;

    this.stopTimer();

    const question = this.getCurrentQuestion();
    const isCorrect = this.validateCurrentConfig();

    this.scores.push({
      question_id: question.question_id,
      is_correct: isCorrect,
    });

    this.createFeedbackPanel(isCorrect);

    setTimeout(() => {
      this.nextQuestion();
    }, 1500);
  }

  nextQuestion() {
    this.currentQuestionIndex++;

    if (this.currentQuestionIndex < this.questions.length) {
      this.loadQuestion(this.currentQuestionIndex);
    } else {
      // Quiz complete
      this.isActive = false;
      this.stopTimer();
      this.createResultsPanel();
    }
  }

  // ==================== TIMER ====================

  startTimer() {
    this.stopTimer();
    this.timerRemaining = TIMER_DURATION;

    this.timerInterval = setInterval(() => {
      this.timerRemaining--;
      if (this.timerRemaining <= 0) {
        this.onTimerExpired();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  onTimerExpired() {
    this.stopTimer();

    const question = this.getCurrentQuestion();
    this.scores.push({
      question_id: question.question_id,
      is_correct: false,
    });

    this.createFeedbackPanel(false);

    setTimeout(() => {
      this.nextQuestion();
    }, 1500);
  }

  // ==================== VALIDATION ====================

  validateCurrentConfig() {
    const question = this.getCurrentQuestion();
    if (!question) return false;

    const target = question.question_properties_values;
    const props = this.extractGearTrainProperties();

    if (!props) return false;

    // Type-based questions delegate to validateByType
    if (target.type) {
      return this.validateByType(target, props);
    }

    const checks = [];

    // Check number of gears
    if (target.noOfGears) {
      checks.push(props.chainLength === parseInt(target.noOfGears));
    }

    // Check module (all gears must match since they need to mesh)
    if (target.module) {
      const targetModule = parseFloat(target.module);
      checks.push(
        props.gearModules.every((m) => Math.abs(m - targetModule) < 0.01)
      );
    }

    // Check driver teeth
    if (target.noOfTeeth) {
      checks.push(props.driverTeeth === parseInt(target.noOfTeeth));
    }

    // Check gear ratio (driverTeeth / outputTeeth)
    if (target.gearRatio) {
      // console.log(targetRatio)
      // const targetRatio = parseFloat(target.gearRatio);

      const [a, b] = target.gearRatio.split(":").map(Number);
      const targetRatio = a / b;
      checks.push(Math.abs(props.overallGearRatio - targetRatio) < 0.1);
    }

    // Check output RPM (last gear in chain)
    if (target.rpm) {
      const targetRPM = parseFloat(target.rpm);
      checks.push(Math.abs(props.outputRPM - targetRPM) < 0.5);
    }

    return checks.length > 0 && checks.every((c) => c === true);
  }

  extractGearTrainProperties() {
    const gears = this.simulator.gears;
    if (gears.length === 0) return null;

    // Ensure speeds are calculated
    this.simulator.calculateGearSpeeds();

    // Find the driver gear
    const driver = gears.find((g) => g.isDriver) || gears[0];

    // BFS from driver to get connected chain
    const visited = new Set();
    const ordered = [];
    const queue = [driver];
    visited.add(driver);

    while (queue.length > 0) {
      const current = queue.shift();
      ordered.push(current);
      for (const connected of current.connectedTo) {
        if (!visited.has(connected)) {
          visited.add(connected);
          queue.push(connected);
        }
      }
    }

    const outputGear = ordered[ordered.length - 1];

    return {
      chainLength: ordered.length,
      driverTeeth: driver.params.teeth,
      outputTeeth: outputGear.params.teeth,
      outputRPM: Math.abs(outputGear.rpm),
      outputTorque: INPUT_TORQUE * (outputGear.params.teeth / driver.params.teeth),
      inputRPM: this.simulator.inputRPM,
      overallGearRatio: driver.params.teeth / outputGear.params.teeth,
      gearModules: ordered.map((g) => g.params.module),
      gears: ordered,
    };
  }

  validateByType(target, props) {
    switch (target.type) {
      case "gearRatio": {
        const parts = target.targetRatio.split(":");
        const targetRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
        return Math.abs(props.overallGearRatio - targetRatio) < 0.1;
      }
      case "rpmOut": {
        const targetRPM = parseFloat(target.rpmOut);
        return Math.abs(props.outputRPM - targetRPM) < 0.5;
      }
      case "torqueOut": {
        const targetTorque = parseFloat(target.torqueOut);
        return Math.abs(props.outputTorque - targetTorque) < 0.5;
      }
      default:
        console.warn("Unknown question type:", target.type);
        return false;
    }
  }

  getTypeDisplayLines(props) {
    switch (props.type) {
      case "gearRatio":
        return [`Build a gear train with ratio ${props.targetRatio}`];
      case "rpmOut":
        return [
          `Achieve output RPM of ${props.rpmOut}`,
          `Input RPM: ${this.simulator.inputRPM}`,
        ];
      case "torqueOut":
        return [
          `Achieve output torque of ${props.torqueOut} Nm`,
          `Input Torque: ${INPUT_TORQUE} Nm`,
          `Input RPM: ${this.simulator.inputRPM}`,
        ];
      default:
        return [`Unknown question type: ${props.type}`];
    }
  }

  // ==================== HELPERS ====================

  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] || null;
  }

  removePanel(key) {
    if (this.panels[key]) {
      this.simulator.scene.remove(this.panels[key]);
      this.panels[key] = null;
    }
  }

  removeQuizPanels() {
    this.stopTimer();
    for (const key in this.panels) {
      this.removePanel(key);
    }
  }
}
