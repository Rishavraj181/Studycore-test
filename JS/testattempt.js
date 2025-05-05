// --- testattempt.js ---

// Ensure this script is included AFTER the specific test data variables are defined in the HTML.
// EXPECTED GLOBAL VARIABLES defined in HTML before this script:
// - testData (Array of question objects)
// - CURRENT_TEST_NAME (String, e.g., "JEE Main 8 April S2")
// - RESULT_PAGE_URL (String, e.g., "JM8aprilS2result.html")
// - TEST_DURATION_MINUTES (Number, e.g., 180)

document.addEventListener('DOMContentLoaded', () => {
    // --- Validate required global variables ---
    // (Keep existing validation code)
    if (typeof testData === 'undefined' || !Array.isArray(testData)) {
        console.error("FATAL: 'testData' array is not defined globally in the HTML before Testattempt.js.");
        alert("Error: Test configuration is missing. Cannot load test.");
        return;
    }
    if (typeof CURRENT_TEST_NAME === 'undefined' || typeof CURRENT_TEST_NAME !== 'string') {
        console.error("FATAL: 'CURRENT_TEST_NAME' string is not defined globally in the HTML before Testattempt.js.");
        alert("Error: Test configuration is missing. Cannot load test.");
        return;
    }
    if (typeof RESULT_PAGE_URL === 'undefined' || typeof RESULT_PAGE_URL !== 'string') {
        console.error("FATAL: 'RESULT_PAGE_URL' string is not defined globally in the HTML before Testattempt.js.");
        alert("Error: Test configuration is missing. Cannot load test.");
        return;
    }
     if (typeof TEST_DURATION_MINUTES === 'undefined' || typeof TEST_DURATION_MINUTES !== 'number') {
        console.warn("'TEST_DURATION_MINUTES' is not defined globally in the HTML. Defaulting to 180 minutes.");
        window.TEST_DURATION_MINUTES = 180; // Set default
    }
    // --- END Validation ---

    // --- State Variables ---
    let currentSection = testData.length > 0 ? testData[0].section : null;
    let currentQuestionIndexInSection = 0; // Index WITHIN the current section
    let currentQuestionGlobalIndex = 0; // Index in the main testData array
    let timeLeft = typeof TEST_DURATION_MINUTES !== 'undefined' ? TEST_DURATION_MINUTES * 60 : 180 * 60;
    let timerInterval = null;
    let testSubmitted = false;
    // **NEW**: State variables for time tracking per question
    let questionStartTime = null; // Timestamp when the current question was loaded

    // --- DOM Elements ---
    // (Keep all existing DOM element references)
    const sectionNav = document.querySelector('.section-nav');
    const timerEl = document.getElementById('timer');
    const currentSectionNameEl = document.getElementById('current-section-name');
    const paletteSectionNameEl = document.getElementById('palette-section-name');
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const questionPalette = document.getElementById('question-palette');
    const markReviewBtn = document.getElementById('mark-review-btn');
    const clearResponseBtn = document.getElementById('clear-response-btn');
    const saveNextBtn = document.getElementById('save-next-btn');
    const submitTestBtn = document.getElementById('submit-test-btn');
    const summaryOverlay = document.getElementById('summary-overlay');
    const summaryTableBody = document.querySelector('#summary-table tbody');
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
    const cancelSubmitBtn = document.getElementById('cancel-submit-btn');
    const testTitleElement = document.querySelector('.header-left h1');
    // --- END DOM Elements ---

    // --- Marking Scheme ---
    // (Keep existing MARKING_SCHEME)
    const MARKING_SCHEME = { mcq: { correct: 4, incorrect: -1, unattempted: 0 }, integer: { correct: 4, incorrect: -1, unattempted: 0 } };
    // --- END Marking Scheme ---

    // --- MathJax Loading ---
    // (Keep existing loadMathJax function)
    function loadMathJax() { if (typeof MathJax !== 'undefined') { return; } console.log("Configuring and loading MathJax..."); window.MathJax = { tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: true }, svg: { fontCache: 'global' }, options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] }, startup: { ready: () => { console.log('MathJax is loaded and ready.'); MathJax.startup.defaultReady(); } } }; const script = document.createElement('script'); script.type = 'text/javascript'; script.id = 'MathJax-script'; script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js'; script.async = true; document.head.appendChild(script); }
    // --- END MathJax Loading ---

    // --- Core Functions ---

    const sections = [...new Set(testData.map(q => q.section))];

    function getSectionQuestions() {
        if (!currentSection) return [];
        return testData.filter(q => q.section === currentSection);
    }

    // (Keep existing formatTime and updateTimer functions)
    function formatTime(seconds) { const h = Math.floor(seconds / 3600).toString().padStart(2, '0'); const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0'); const s = Math.max(0, seconds % 60).toString().padStart(2, '0'); return `${h}:${m}:${s}`; }
    function updateTimer() { if (timerEl) { timerEl.textContent = formatTime(timeLeft); } if (timeLeft <= 0) { clearInterval(timerInterval); timerInterval = null; if (!testSubmitted) { alert("Time's up! The test will be submitted automatically."); submitTest(); } } else if (!testSubmitted) { timeLeft--; } }
    // --- END Timer Functions ---

    function renderSectionTabs() {
        // (Keep existing renderSectionTabs function)
        if (!sectionNav) return; sectionNav.innerHTML = ''; sections.forEach(section => { const tab = document.createElement('button'); tab.classList.add('section-tab'); tab.textContent = section; tab.dataset.section = section; if (section === currentSection) { tab.classList.add('active'); } tab.addEventListener('click', () => switchSection(section)); sectionNav.appendChild(tab); });
    }

    function switchSection(sectionName) {
        if (testSubmitted || sectionName === currentSection) return;

        // **MODIFIED**: Call stopQuestionTimer before changing section/question
        stopQuestionTimer(); // Record time for the question being left

        currentSection = sectionName;
        // Find the first question *global* index in the new section
        const firstGlobalIndexInNewSection = testData.findIndex(q => q.section === sectionName);
        // Find the index *within the section*
        const questionsInNewSection = getSectionQuestions();
        const firstIndexInSection = questionsInNewSection.findIndex(q => q.id === testData[firstGlobalIndexInNewSection]?.id);

        currentQuestionIndexInSection = (firstIndexInSection !== -1) ? firstIndexInSection : 0; // Update section index
        currentQuestionGlobalIndex = (firstGlobalIndexInNewSection !== -1) ? firstGlobalIndexInNewSection : -1; // Update global index, handle error case

        renderSectionTabs(); // Update active tab style
        renderQuestionPalette(); // Render palette for the new section

        if (currentQuestionGlobalIndex !== -1) {
            loadQuestion(currentQuestionIndexInSection); // Load the first question of the new section
        } else {
            console.error("Could not find first question for section:", sectionName);
            // Handle error - maybe display a message
             if(questionTextEl) questionTextEl.innerHTML = `Error: Could not load questions for section ${sectionName}.`;
             if(optionsContainer) optionsContainer.innerHTML = "";
        }
    }

    // --- **NEW**: Function to stop timer for the current question and record time ---
    function stopQuestionTimer() {
        if (currentQuestionGlobalIndex !== -1 && currentQuestionGlobalIndex < testData.length && questionStartTime) {
            const durationMillis = Date.now() - questionStartTime;
            const durationSeconds = durationMillis / 1000;

            // Ensure timeSpent exists and is a number before adding
            const currentQ = testData[currentQuestionGlobalIndex];
            if (currentQ) {
                currentQ.timeSpent = (currentQ.timeSpent || 0) + durationSeconds;
                // console.log(`Stopped timer for Q (Global Index: ${currentQuestionGlobalIndex}, ID: ${currentQ.id}). Added ${durationSeconds.toFixed(2)}s. Total: ${currentQ.timeSpent.toFixed(2)}s`); // Debugging
            } else {
                 console.warn("Could not find question object for global index:", currentQuestionGlobalIndex, "while stopping timer.");
            }
        }
        // Reset start time - it will be set again when the next question loads
        questionStartTime = null;
    }
    // --- **END NEW FUNCTION** ---

    // **REMOVED**: handleLeavingQuestion function (Replaced by stopQuestionTimer)
    // We now explicitly call stopQuestionTimer before any navigation or state change.

    function renderQuestionPalette() {
        // (Keep existing renderQuestionPalette, ensure it uses indexInSection for dataset and listener)
        if (!questionPalette || !paletteSectionNameEl) return; questionPalette.innerHTML = ''; paletteSectionNameEl.textContent = currentSection || 'Palette'; const questions = getSectionQuestions(); questions.forEach((q, indexInSection) => { const btn = document.createElement('button'); btn.classList.add('q-btn'); btn.textContent = indexInSection + 1; btn.dataset.indexInSection = indexInSection; btn.dataset.id = q.id; updatePaletteButtonClass(btn, q.status); const currentQuestionObject = questions[currentQuestionIndexInSection]; if (currentQuestionObject && q.id === currentQuestionObject.id) { btn.classList.add('active-question'); } btn.addEventListener('click', () => jumpToQuestion(indexInSection)); questionPalette.appendChild(btn); });
    }

    function updatePaletteButtonClass(buttonElement, status) {
        // (Keep existing updatePaletteButtonClass)
        if(!buttonElement) return; const isActive = buttonElement.classList.contains('active-question'); buttonElement.className = 'q-btn'; if (isActive) buttonElement.classList.add('active-question'); switch (status) { case 'answered': buttonElement.classList.add('answered'); break; case 'marked-review': buttonElement.classList.add('marked-review'); break; case 'answered-marked-review': buttonElement.classList.add('answered-marked-review'); break; case 'not-answered': buttonElement.classList.add('not-answered'); break; case 'not-visited': default: buttonElement.classList.add('not-visited'); break; }
    }

    function updateQuestionStatus(indexInSection, newStatus) {
        // (Keep existing updateQuestionStatus)
        const questions = getSectionQuestions(); if (indexInSection >= 0 && indexInSection < questions.length) { const question = questions[indexInSection]; if (question) { question.status = newStatus; const btn = questionPalette.querySelector(`.q-btn[data-index-in-section="${indexInSection}"]`); if (btn) { updatePaletteButtonClass(btn, newStatus); } } }
    }

    function loadQuestion(indexInSection) { // Parameter is index WITHIN the current section
        if (testSubmitted) return;
        const questions = getSectionQuestions();

        // (Keep validation for indexInSection)
        if (!questions || indexInSection < 0 || indexInSection >= questions.length) { console.error("Attempted to load invalid question index:", indexInSection, "in section:", currentSection); if (questions && questions.length > 0) { indexInSection = 0; } else { questionTextEl.innerHTML = 'Error: No questions available in this section.'; optionsContainer.innerHTML = ''; return; } }

        // Find the corresponding global index
        const questionToLoad = questions[indexInSection];
        const globalIndex = testData.findIndex(q => q.id === questionToLoad.id);

        if (globalIndex === -1) {
            console.error("Could not find global index for question with ID:", questionToLoad.id);
            return; // Cannot proceed without global index
        }

        // ** NEW: Stop timer for the PREVIOUS question *before* updating indexes **
        // No need to call here if called before navigation (e.g., in jumpToQuestion)
        // stopQuestionTimer(); // Call moved to navigation functions

        // Update state variables
        currentQuestionIndexInSection = indexInSection;
        currentQuestionGlobalIndex = globalIndex;
        const question = testData[currentQuestionGlobalIndex]; // Get the question from the main array

        if (!question) {
            console.error("Question object not found at global index", currentQuestionGlobalIndex);
            return;
        }

        // Mark as 'not-answered' if first visit
        if (question.status === 'not-visited') {
            updateQuestionStatus(indexInSection, 'not-answered'); // Update status and button
        } else {
            const btn = questionPalette.querySelector(`.q-btn[data-index-in-section="${indexInSection}"]`);
            if(btn) updatePaletteButtonClass(btn, question.status);
        }

        // (Keep UI Updates: section name, question number, text)
        if (currentSectionNameEl) currentSectionNameEl.textContent = currentSection;
        if (questionNumberEl) questionNumberEl.textContent = `Question No. ${indexInSection + 1}`;
        if (questionTextEl) questionTextEl.innerHTML = question.questionText || 'Question text not loaded.';

        // (Keep Palette Highlighting update)
        if (questionPalette) { questionPalette.querySelectorAll('.q-btn.active-question').forEach(btn => btn.classList.remove('active-question')); const currentPaletteBtn = questionPalette.querySelector(`.q-btn[data-index-in-section="${indexInSection}"]`); if (currentPaletteBtn) { currentPaletteBtn.classList.add('active-question'); } }

        // (Keep Render Options/Input logic)
        if (optionsContainer) { optionsContainer.innerHTML = ''; if (question.type === 'mcq' && question.options) { question.options.forEach((option, i) => { const optionId = `q${question.id}_opt${i}`; const div = document.createElement('div'); div.classList.add('option'); const isChecked = question.userAnswer === i; div.innerHTML = `<label for="${optionId}"><input type="radio" id="${optionId}" name="q${question.id}_options" value="${i}" ${isChecked ? 'checked' : ''}><span>${option || ''}</span></label>`; optionsContainer.appendChild(div); }); } else if (question.type === 'integer') { const inputId = `q${question.id}_input`; const input = document.createElement('input'); input.setAttribute('type', 'text'); input.setAttribute('id', inputId); input.classList.add('integer-input'); input.placeholder = "Enter your answer"; input.value = (question.userAnswer !== null && question.userAnswer !== undefined) ? question.userAnswer : ''; optionsContainer.appendChild(input); } }

        // (Keep MathJax Typesetting trigger)
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) { const elementsToTypeset = [questionTextEl, optionsContainer].filter(el => el !== null); if (elementsToTypeset.length > 0) { MathJax.typesetPromise(elementsToTypeset) .catch((err) => console.error('MathJax typesetting error:', err)); } } else if (typeof MathJax === 'undefined') { console.warn("MathJax is not yet available. Typesetting skipped for question:", question.id); }

        // --- **NEW**: Start timer for the newly loaded question ---
        questionStartTime = Date.now();
        // console.log(`Started timer for Q (Global Index: ${currentQuestionGlobalIndex}, ID: ${question.id}) at ${questionStartTime}`); // Debugging
        // --- **END NEW CODE** ---
    }


    function getSelectedAnswer() {
        // (Keep existing getSelectedAnswer function, ensure it uses currentQuestionIndexInSection)
        const questions = getSectionQuestions();
        // Use currentQuestionIndexInSection here
        if (!questions || currentQuestionIndexInSection >= questions.length) return null;
        const question = questions[currentQuestionIndexInSection];
        if (!question || !optionsContainer) return null;

        if (question.type === 'mcq') { const selectedRadio = optionsContainer.querySelector(`input[name="q${question.id}_options"]:checked`); return selectedRadio ? parseInt(selectedRadio.value, 10) : null; }
        else if (question.type === 'integer') { const input = optionsContainer.querySelector('.integer-input'); return input && input.value.trim() !== '' ? input.value.trim() : null; }
        return null;
    }


    // --- Button Action Handlers ---

    function saveAndNext() {
        if (testSubmitted) return;
        const questions = getSectionQuestions();
        // Use currentQuestionIndexInSection
        if (!questions || currentQuestionIndexInSection >= questions.length) return;

        // **MODIFIED**: Stop timer for current question FIRST
        stopQuestionTimer();

        const question = questions[currentQuestionIndexInSection];
        const selectedAnswer = getSelectedAnswer();
        question.userAnswer = selectedAnswer; // Store the answer in the object from getSectionQuestions() which points to testData object

        // (Keep existing status update logic)
        let newStatus = (selectedAnswer !== null) ? ((question.status === 'marked-review' || question.status === 'answered-marked-review') ? 'answered-marked-review' : 'answered') : ((question.status === 'marked-review' || question.status === 'answered-marked-review') ? 'marked-review' : 'not-answered');

        updateQuestionStatus(currentQuestionIndexInSection, newStatus); // Update data and palette button
        moveToNextQuestion(); // This will load the next question and start its timer
    }


    function markForReviewAndNext() {
        if (testSubmitted) return;
        const questions = getSectionQuestions();
        // Use currentQuestionIndexInSection
        if (!questions || currentQuestionIndexInSection >= questions.length) return;

        // **MODIFIED**: Stop timer for current question FIRST
        stopQuestionTimer();

        const question = questions[currentQuestionIndexInSection];
        const selectedAnswer = getSelectedAnswer();
        question.userAnswer = selectedAnswer; // Store the answer

        const newStatus = (selectedAnswer !== null) ? 'answered-marked-review' : 'marked-review';
        updateQuestionStatus(currentQuestionIndexInSection, newStatus);
        moveToNextQuestion(); // This will load the next question and start its timer
    }


    function clearResponse() {
        if (testSubmitted) return;
        const questions = getSectionQuestions();
         // Use currentQuestionIndexInSection
        if (!questions || currentQuestionIndexInSection >= questions.length) return;

        // NOTE: Clearing response doesn't navigate away, so we DON'T stop/restart the timer here.
        // The timer continues for the current question.

        const question = questions[currentQuestionIndexInSection];
        question.userAnswer = null; // Clear the stored answer

        const newStatus = (question.status === 'marked-review' || question.status === 'answered-marked-review') ? 'marked-review' : 'not-answered';
        updateQuestionStatus(currentQuestionIndexInSection, newStatus); // Update data and palette button

        // (Keep UI clearing logic)
        if (question.type === 'mcq' && optionsContainer) { optionsContainer.querySelectorAll(`input[name="q${question.id}_options"]`).forEach(radio => radio.checked = false); }
        else if (question.type === 'integer' && optionsContainer) { const input = optionsContainer.querySelector('.integer-input'); if (input) input.value = ''; }
    }


    function moveToNextQuestion() {
         // Note: stopQuestionTimer() should have been called by the invoking function (saveAndNext, markForReviewAndNext)
         const questions = getSectionQuestions();
         if (currentQuestionIndexInSection < questions.length - 1) {
             // Move to the next question within the current section
             loadQuestion(currentQuestionIndexInSection + 1); // loadQuestion will start the timer for the new question
         } else {
             // End of current section, try moving to the next section
             const currentSectionGlobalIndex = sections.indexOf(currentSection);
             if (currentSectionGlobalIndex < sections.length - 1) {
                 // Switch to the first question of the next section
                 // switchSection already calls stopQuestionTimer() before switching
                 switchSection(sections[currentSectionGlobalIndex + 1]);
             } else {
                 alert("You have reached the end of the last section.");
                 // Re-start timer for the last question if needed? Or stop? Let's stop.
                 // The timer was stopped by the calling function, and we don't load a new one.
                 // questionStartTime = null; // Timer should already be null
             }
         }
     }


    function jumpToQuestion(indexInSection) { // Parameter is index WITHIN the current section
        if (testSubmitted) return;
        const questions = getSectionQuestions();
        if (indexInSection >= 0 && indexInSection < questions.length && indexInSection !== currentQuestionIndexInSection) {
             // **MODIFIED**: Stop timer for current question BEFORE loading the new one
             stopQuestionTimer();
             loadQuestion(indexInSection); // Load the clicked question (this will start its timer)
        }
    }


    function showSummary() {
         if (testSubmitted || !summaryOverlay || !summaryTableBody) return;

         // **MODIFIED**: Stop timer for the current question before showing summary
         stopQuestionTimer();
         // Capture current answer state might not be needed if stopQuestionTimer() implicitly handles it, but safer to keep?
         // Let's assume userAnswer is updated correctly by stopQuestionTimer or other actions.

        // (Keep existing summary table generation logic)
        summaryTableBody.innerHTML = ''; let totals = { total: testData.length, answered: 0, notAnswered: 0, markedReview: 0, answeredMarkedReview: 0, notVisited: 0 }; sections.forEach(section => { const questionsInSection = testData.filter(q => q.section === section); const counts = { total: questionsInSection.length, answered: 0, notAnswered: 0, markedReview: 0, answeredMarkedReview: 0, notVisited: 0 }; questionsInSection.forEach(q => { switch(q.status) { case 'answered': counts.answered++; break; case 'not-answered': counts.notAnswered++; break; case 'marked-review': counts.markedReview++; break; case 'answered-marked-review': counts.answeredMarkedReview++; break; case 'not-visited': counts.notVisited++; break; default: counts.notVisited++; } }); const row = summaryTableBody.insertRow(); row.innerHTML = `<td>${section}</td><td>${counts.total}</td><td>${counts.answered}</td><td>${counts.notAnswered}</td><td>${counts.markedReview}</td><td>${counts.answeredMarkedReview}</td><td>${counts.notVisited}</td>`; totals.answered += counts.answered; totals.notAnswered += counts.notAnswered; totals.markedReview += counts.markedReview; totals.answeredMarkedReview += counts.answeredMarkedReview; totals.notVisited += counts.notVisited; }); const totalRow = summaryTableBody.insertRow(); totalRow.style.fontWeight = 'bold'; totalRow.innerHTML = `<td>Total</td><td>${totals.total}</td><td>${totals.answered}</td><td>${totals.notAnswered}</td><td>${totals.markedReview}</td><td>${totals.answeredMarkedReview}</td><td>${totals.notVisited}</td>`;


        summaryOverlay.style.display = 'flex'; // Show the summary overlay
    }


    // --- Result Calculation & Submission ---
    function submitTest() {
        if (testSubmitted) return;

        // **MODIFIED**: Stop timer for the current question one last time
        stopQuestionTimer();

        testSubmitted = true;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (timerEl) timerEl.textContent = formatTime(0);
        if (summaryOverlay) summaryOverlay.style.display = 'none';

        // (Keep existing UI disabling logic)
         const elementsToDisable = [saveNextBtn, markReviewBtn, clearResponseBtn, submitTestBtn, confirmSubmitBtn, cancelSubmitBtn, ...(sectionNav ? Array.from(sectionNav.querySelectorAll('button')) : []), ...(questionPalette ? Array.from(questionPalette.querySelectorAll('button')) : []), ...(optionsContainer ? Array.from(optionsContainer.querySelectorAll('input, button, label')) : [])]; elementsToDisable.forEach(el => { if (el) { el.disabled = true; if (el.tagName === 'LABEL') { el.style.cursor = 'default'; } } }); if(optionsContainer) { optionsContainer.style.pointerEvents = 'none'; optionsContainer.style.opacity = '0.7'; }

        console.log("Test Submitted. Calculating and saving results...");

        // --- Calculate Results ---
        // (Keep existing result calculation logic - it uses the status which is updated)
        let overallScore = 0; let overallCorrect = 0; let overallIncorrect = 0; let overallUnattempted = 0; const uniqueSections = [...new Set(testData.map(q => q.section))]; const sectionStats = {};
        // Use the *original* testData array which now has timeSpent populated
        const processedTestData = testData; // No need for deep copy IF we only add properties

        uniqueSections.forEach(sec => { sectionStats[sec] = { score: 0, correct: 0, incorrect: 0, unattempted: 0, total: 0, maxMarks: 0 /* Added maxMarks */ }; });

        processedTestData.forEach(q => {
            const scheme = MARKING_SCHEME[q.type] || { correct: 0, incorrect: 0, unattempted: 0 };
            let marksAwarded = 0; let resultStatus = 'unattempted';
            if (sectionStats[q.section]) { sectionStats[q.section].total++; sectionStats[q.section].maxMarks += scheme.correct; } // Calculate max marks
            else { console.warn(`Section "${q.section}" not found in stats for question ID ${q.id}`); }

            let attempted = (q.status === 'answered' || q.status === 'answered-marked-review');
            if (q.type === 'integer' && attempted && (q.userAnswer === null || q.userAnswer === undefined || String(q.userAnswer).trim() === '')) { attempted = false; }

            if (attempted) {
                let userAnswerCompared = q.userAnswer; let correctAnswerCompared = q.correctAnswer;
                if (q.type === 'integer') { const userNum = parseFloat(userAnswerCompared); const correctNum = parseFloat(correctAnswerCompared); if (!isNaN(userNum) && !isNaN(correctNum) && userNum === correctNum) { marksAwarded = scheme.correct; resultStatus = 'correct'; overallCorrect++; sectionStats[q.section].correct++; } else if (!isNaN(userNum)){ marksAwarded = scheme.incorrect; resultStatus = 'incorrect'; overallIncorrect++; sectionStats[q.section].incorrect++; } else { attempted = false; } }
                else if (q.type === 'mcq') { userAnswerCompared = parseInt(userAnswerCompared, 10); correctAnswerCompared = parseInt(correctAnswerCompared, 10); if (!isNaN(userAnswerCompared) && userAnswerCompared === correctAnswerCompared) { marksAwarded = scheme.correct; resultStatus = 'correct'; overallCorrect++; sectionStats[q.section].correct++; } else { marksAwarded = scheme.incorrect; resultStatus = 'incorrect'; overallIncorrect++; sectionStats[q.section].incorrect++; } }
            }

            if (!attempted) { marksAwarded = scheme.unattempted; resultStatus = 'unattempted'; overallUnattempted++; sectionStats[q.section].unattempted++; q.userAnswer = null; }

            q.marksAwarded = marksAwarded; q.resultStatus = resultStatus;
            overallScore += marksAwarded;
            if (sectionStats[q.section]) { sectionStats[q.section].score += marksAwarded; }
        });

        // Calculate overall max score for summary
        const overallMaxScore = Object.values(sectionStats).reduce((sum, sec) => sum + sec.maxMarks, 0);

        const finalResults = {
             summary: { overallScore, overallCorrect, overallIncorrect, overallUnattempted, totalQuestions: processedTestData.length, maxScore: overallMaxScore, sectionStats }, // Added maxScore
             // **MODIFIED**: Use processedTestData which IS testData with added properties
             detailedData: processedTestData // Ensure timeSpent is now included
         };
        // --- End Calculation ---

        // --- Save to localStorage ---
        const resultEntry = {
            // Use timestamp as ID for better sorting, also store timestamp explicitly
            id: Date.now(),
            timestamp: Date.now(), // Store raw timestamp number
            testName: CURRENT_TEST_NAME,
            resultPageUrl: RESULT_PAGE_URL,
            summary: finalResults.summary,
            detailedData: finalResults.detailedData // This includes timeSpent now
        };

        // (Keep existing localStorage saving logic with try...catch)
        try { const existingResults = JSON.parse(localStorage.getItem('jeeMainResults') || '[]'); existingResults.push(resultEntry); localStorage.setItem('jeeMainResults', JSON.stringify(existingResults)); console.log("Results saved to localStorage successfully."); if (RESULT_PAGE_URL) { window.location.href = RESULT_PAGE_URL; } else { console.warn("RESULT_PAGE_URL is not defined, staying on current page."); alert("Test submitted successfully. Results saved locally. (No redirect configured)"); } }
        catch (error) { console.error("Failed to save results to localStorage:", error); console.error("Error name:", error.name); console.error("Error message:", error.message); if (error instanceof DOMException && error.name === 'QuotaExceededError') { alert("Could not save results: LocalStorage quota exceeded. Please clear some space."); } else { alert("An error occurred while saving your results. Your test is submitted, but results might not be saved in your browser history."); } }
        // --- End Save ---
    }


    // --- Event Listeners Setup ---
    // (Keep existing event listeners setup)
    saveNextBtn?.addEventListener('click', saveAndNext); markReviewBtn?.addEventListener('click', markForReviewAndNext); clearResponseBtn?.addEventListener('click', clearResponse); submitTestBtn?.addEventListener('click', showSummary); confirmSubmitBtn?.addEventListener('click', submitTest); cancelSubmitBtn?.addEventListener('click', () => { if (summaryOverlay) summaryOverlay.style.display = 'none'; });
    // --- END Event Listeners ---

    // --- Initialization ---
    function initTest() {
        console.log(`Initializing test: ${CURRENT_TEST_NAME}`);
        loadMathJax(); // Load MathJax

        // **NEW**: Initialize timeSpent and status for all questions
        testData.forEach(q => {
            q.timeSpent = 0; // Initialize time spent to zero
            q.status = 'not-visited'; // Initialize status
            q.userAnswer = null; // Ensure user answer is initially null
        });
        // **END NEW INIT**

        if (testTitleElement) { testTitleElement.textContent = CURRENT_TEST_NAME; }
        else { console.warn("Test title element not found."); }

        if (!currentSection && sections.length > 0) { currentSection = sections[0]; }

        if (!currentSection) { console.error("No sections found. Cannot initialize test."); alert("Error: Test data appears empty."); if(questionTextEl) questionTextEl.innerHTML = "Error: Test data could not be loaded."; if(optionsContainer) optionsContainer.innerHTML = ""; return; }

        // Set initial global index
        currentQuestionGlobalIndex = testData.findIndex(q => q.section === currentSection);
        if (currentQuestionGlobalIndex === -1) currentQuestionGlobalIndex = 0; // Fallback
        currentQuestionIndexInSection = 0; // Start at the first question within the section

        renderSectionTabs();
        renderQuestionPalette();

        // Load the first question (index 0 within the first section)
        loadQuestion(currentQuestionIndexInSection); // loadQuestion now starts the timer

        // (Keep existing timer start logic)
        if (timeLeft > 0) { if (timerInterval) clearInterval(timerInterval); timerInterval = setInterval(updateTimer, 1000); updateTimer(); }
        else if(timerEl) { timerEl.textContent = formatTime(0); }

        if (summaryOverlay) summaryOverlay.style.display = 'none';
        console.log("Test initialized.");
    }

    // Start the test initialization process
    initTest();

});