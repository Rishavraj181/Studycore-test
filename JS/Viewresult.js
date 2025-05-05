// ==================================================================
// == Exam Results Dashboard & Detailed View Script ==
// ==================================================================

// Ensure this script is included AFTER Chart.js and AFTER the global constants are defined in the HTML.
// EXPECTED GLOBAL VARIABLES defined in HTML before this script:
// - TARGET_TEST_NAME (String, e.g., "JEE Main 8 April S2")
// - MAX_SCORE (Number, e.g., 300)
// - MARKS_CORRECT (Number, e.g., 4)
// - MARKS_INCORRECT (Number, e.g., -1)

document.addEventListener('DOMContentLoaded', () => {

    // --- MathJax Loading Function ---
    function loadMathJax() {
        if (typeof MathJax !== 'undefined') {
            // console.log("Script.js: MathJax already loaded or loading.");
            return; // Avoid loading multiple times
        }
        console.log("Script.js: Configuring and loading MathJax...");
        window.MathJax = {
            tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], processEscapes: true },
            svg: { fontCache: 'global' },
            options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
            startup: {
                ready: () => {
                    console.log('Script.js: MathJax is loaded and ready.');
                    MathJax.startup.defaultReady();
                }
            }
        };
        const script = document.createElement('script');
        script.type = 'text/javascript'; script.id = 'MathJax-script-results';
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
        script.async = true; document.head.appendChild(script);
    }

    // --- Load MathJax ASAP ---
    loadMathJax();

    // --- Validate Required Global Variables ---
    if (typeof TARGET_TEST_NAME !== 'string' ||
        typeof MAX_SCORE !== 'number' ||
        typeof MARKS_CORRECT !== 'number' ||
        typeof MARKS_INCORRECT !== 'number') {
        console.error("FATAL: TARGET_TEST_NAME, MAX_SCORE, MARKS_CORRECT, or MARKS_INCORRECT are not defined globally in the HTML before script.js.");
        alert("Error: Results page configuration is missing. Cannot load results.");
        const selectAttemptMsgEl = document.getElementById('select-attempt-message');
        if (selectAttemptMsgEl) {
            selectAttemptMsgEl.innerHTML = '<p>Page configuration error. Please contact support or check the test setup.</p>';
            selectAttemptMsgEl.style.display = 'flex';
        }
        return; // Stop script execution
    }
    console.log("Global configuration loaded:", { TARGET_TEST_NAME, MAX_SCORE, MARKS_CORRECT, MARKS_INCORRECT });

    // --- DOM Element References ---
    const headerExamTitle = document.getElementById('exam-title');
    const headerExamDateTime = document.getElementById('exam-date-time');
    const headerScoreEl = document.getElementById('header-score');
    const headerMaxScoreEl = document.getElementById('header-max-score');
    const attemptsList = document.getElementById('attempts-list');
    const selectAttemptMessage = document.getElementById('select-attempt-message');
    const dashboardView = document.getElementById('dashboard-view');
    const detailedResultsArea = document.getElementById('detailed-results-area');
    const scorePieChartCanvas = document.getElementById('scorePieChart');
    const chartLegendEl = document.getElementById('chart-legend');
    const metricTimeEl = document.getElementById('metric-time');
    const metricAccuracyEl = document.getElementById('metric-accuracy');
    const metricAttemptedEl = document.getElementById('metric-attempted');
    const metricNegativeEl = document.getElementById('metric-negative');
    const timeCorrectEl = document.getElementById('time-correct');
    const timeWrongEl = document.getElementById('time-wrong');
    const timeNotAttemptedEl = document.getElementById('time-not-attempted');
    const sectionsTableBody = document.getElementById('sections-table-body');
    const viewAllQuestionsBtn = document.getElementById('view-all-questions-btn');
    const detailedSectionCardsContainer = document.getElementById('detailed-section-cards-container');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const printButton = document.getElementById('print-results-button'); // Detailed print button
    const printDashboardBtn = document.getElementById('print-dashboard-btn'); // NEW Dashboard print button
    const attemptTimestampEl = document.getElementById('attempt-timestamp');
    const reviewSectionTabsContainer = document.getElementById('review-section-tabs');
    const reviewQuestionsContainer = document.getElementById('review-questions-container');

    // --- State Variables ---
    let targetResults = [];
    let currentSelectedAttempt = null;
    let currentDetailedData = [];
    let scorePieChart = null;

    // --- Define Predefined Section Order ---
    const PREDEFINED_SECTION_ORDER = [
        'Physics (MCQ)', 'Physics (Integer)',
        'Chemistry (MCQ)', 'Chemistry (Integer)',
        'Maths (MCQ)', 'Maths (Integer)',
        'Mathematics (MCQ)', 'Mathematics (Integer)' // Allow for variations
    ];

    // --- Custom Section Sorting Function ---
    function getSectionSortIndex(sectionName) {
        const index = PREDEFINED_SECTION_ORDER.indexOf(sectionName);
        return index === -1 ? PREDEFINED_SECTION_ORDER.length + (sectionName?.length || 0) : index;
    }
    function sortSectionsCustom(sectionA, sectionB) {
        const indexA = getSectionSortIndex(sectionA);
        const indexB = getSectionSortIndex(sectionB);
        if (indexA !== indexB) return indexA - indexB;
        return (sectionA || '').localeCompare(sectionB || '');
    }

    // --- Utility Functions ---
    function formatTime(totalSeconds) {
        if (isNaN(totalSeconds) || totalSeconds < 0) return "--h --m --s";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
        if (seconds >= 0 && (minutes > 0 || hours > 0 || parts.length === 0)) parts.push(`${seconds}s`);
        if (parts.length === 0 && totalSeconds === 0) return "0s";
        return parts.length > 0 ? parts.join(' ') : "--h --m --s";
    }

    function formatTotalTime(totalSeconds) {
        if (isNaN(totalSeconds) || totalSeconds < 0) return "--:--:--";
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function getLocalStorageData(key, defaultValue = []) {
        try {
            const storedValue = localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch (error) {
            console.error(`Error reading or parsing localStorage key "${key}":`, error);
            return defaultValue;
        }
    }

    // --- Core Logic Functions ---

    /**
     * Loads attempts from localStorage, filters them for the TARGET_TEST_NAME,
     * sorts them (latest first), and populates the attempts list in the sidebar.
     */
    function loadAndFilterAttempts() {
        // Set initial header information
        headerExamTitle.textContent = TARGET_TEST_NAME;
        headerMaxScoreEl.textContent = MAX_SCORE;
        headerScoreEl.textContent = '---';
        headerExamDateTime.textContent = 'Select an attempt';

        const allResults = getLocalStorageData('jeeMainResults', []);
        targetResults = allResults.filter(attempt =>
            attempt.testName === TARGET_TEST_NAME && attempt.summary && attempt.detailedData && Array.isArray(attempt.detailedData)
        );

        attemptsList.innerHTML = '';
        if (targetResults.length === 0) {
            attemptsList.innerHTML = `<li class="no-attempts">No past attempts found for ${TARGET_TEST_NAME}.</li>`;
            selectAttemptMessage.style.display = 'flex';
            dashboardView.style.display = 'none';
            detailedResultsArea.style.display = 'none';
            return;
        }

        // Robust attempt sorting (Latest First)
        const getSortValue = (attempt) => {
            const ts = attempt?.timestamp; const id = attempt?.id;
            if (typeof ts === 'number' && !isNaN(ts)) return ts;
            if (typeof id === 'number' && !isNaN(id)) return id;
            if (typeof id === 'string') { const numericId = Number(id); if (!isNaN(numericId)) return numericId; }
            console.warn(`Attempt (ID: ${id}, TS: ${ts}) missing sortable time value.`);
            return Number.MIN_SAFE_INTEGER;
        };
        targetResults.sort((a, b) => getSortValue(b) - getSortValue(a));
        console.log("Sorted Attempt Order (Newest First Expected):", targetResults.map(att => ({ id: att.id, timestamp: att.timestamp })));

        // Populate the list
        targetResults.forEach((attempt, index) => {
            const listItem = document.createElement('li');
            listItem.dataset.attemptIndex = index;
            const score = attempt.summary?.overallScore ?? 'N/A';
            const attemptDate = new Date(attempt.timestamp || attempt.id); // Use numeric timestamp
            const dateString = isNaN(attemptDate) || getSortValue(attempt) === Number.MIN_SAFE_INTEGER ? 'Unknown Date' : attemptDate.toLocaleString();
            listItem.innerHTML = `<span>${dateString}</span><span>Score: ${score}</span>`;
            listItem.addEventListener('click', () => {
                document.querySelectorAll('#attempts-list li.selected-attempt').forEach(el => el.classList.remove('selected-attempt'));
                listItem.classList.add('selected-attempt');
                currentSelectedAttempt = targetResults[index];
                console.log("Attempt selected:", currentSelectedAttempt.id);
                displayDashboardView(currentSelectedAttempt);
            });
            attemptsList.appendChild(listItem);
        });

        selectAttemptMessage.style.display = 'flex';
        dashboardView.style.display = 'none';
        detailedResultsArea.style.display = 'none';
    }

    /**
     * Displays the main dashboard view with summary stats, chart, tables, and section cards.
     * @param {object} attemptData - The data object for the selected attempt.
     */
    function displayDashboardView(attemptData) {
        // --- Validation ---
        if (!attemptData || !attemptData.summary || !attemptData.detailedData) { console.error("Invalid attempt data for dashboard:", attemptData); /* ... error handling ... */ return; }
        console.log("Displaying dashboard for attempt:", attemptData.id);

        // --- Extract Data ---
        const summary = attemptData.summary; const details = attemptData.detailedData; currentDetailedData = details;

        // --- Update Header ---
        headerExamTitle.textContent = attemptData.testName || TARGET_TEST_NAME;
        const attemptDate = new Date(attemptData.timestamp || attemptData.id);
        headerExamDateTime.textContent = `Attempt Time: ${isNaN(attemptDate) ? 'Unknown' : attemptDate.toLocaleString()}`;
        headerScoreEl.textContent = summary.overallScore ?? '---'; headerMaxScoreEl.textContent = summary.maxScore ?? MAX_SCORE;

        // --- Calculate Metrics ---
        const correct = summary.overallCorrect ?? 0; const incorrect = summary.overallIncorrect ?? 0; const unattempted = summary.overallUnattempted ?? 0;
        const totalQuestions = summary.totalQuestions ?? (correct + incorrect + unattempted); const attempted = correct + incorrect;
        const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(2) : '0.00';
        const penaltyPerIncorrect = Math.min(0, MARKS_INCORRECT); const negativeMarks = incorrect * penaltyPerIncorrect;
        let totalTimeSpentSeconds = 0; let timeCorrectSeconds = 0; let timeWrongSeconds = 0; let timeNotAttemptedSeconds = 0; let sectionTimesSeconds = {};
        details.forEach(q => {
            const time = q.timeSpent || 0; totalTimeSpentSeconds += time; const section = q.section || 'Unknown';
            if (!sectionTimesSeconds[section]) sectionTimesSeconds[section] = 0;
            sectionTimesSeconds[section] += time;
            switch (q.resultStatus) { case 'correct': timeCorrectSeconds += time; break; case 'incorrect': timeWrongSeconds += time; break; case 'unattempted': default: timeNotAttemptedSeconds += time; break; }
        });

        // --- Populate Dashboard Metric Cards ---
        metricTimeEl.textContent = formatTotalTime(totalTimeSpentSeconds); metricAccuracyEl.textContent = `${accuracy}%`;
        metricAttemptedEl.textContent = `${attempted} / ${totalQuestions}`; metricNegativeEl.textContent = negativeMarks.toFixed(2);

        // --- Populate Time Management Section (Dashboard) ---
        timeCorrectEl.textContent = formatTime(timeCorrectSeconds); timeWrongEl.textContent = formatTime(timeWrongSeconds);
        timeNotAttemptedEl.textContent = formatTime(timeNotAttemptedSeconds);

        // --- Render Pie Chart ---
        const chartData = { labels: [`Correct (${correct})`, `Wrong (${incorrect})`, `Not Attempted (${unattempted})`], datasets: [{ data: [correct, incorrect, unattempted], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], hoverOffset: 4, borderColor: '#ffffff', borderWidth: 1 }] };
        if (scorePieChart) scorePieChart.destroy();
        if (scorePieChartCanvas) {
            const ctx = scorePieChartCanvas.getContext('2d');
            scorePieChart = new Chart(ctx, { type: 'pie', data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => { let l=ctx.label||''; if(l)l+=': '; if(ctx.parsed!==null)l+=ctx.parsed; const t=ctx.dataset.data.reduce((a,b)=>a+b,0); const p=t>0?((ctx.parsed/t)*100).toFixed(1)+'%':'0%'; l+=` (${p})`; return l; } } } } } });
            chartLegendEl.innerHTML = ''; chartData.labels.forEach((label, index) => { const color = chartData.datasets[0].backgroundColor[index]; const item = document.createElement('div'); item.className = 'legend-item'; item.innerHTML = `<span class="legend-color-box" style="background-color: ${color};"></span><span>${label}</span>`; chartLegendEl.appendChild(item); });
        } else { console.warn("Pie chart canvas element not found."); }

        // --- Populate Sections Overview Table ---
        sectionsTableBody.innerHTML = ''; const sectionStats = summary.sectionStats || {};
        const sections = [...new Set(details.map(q => q.section).filter(Boolean))].sort(sortSectionsCustom);
        if (sections.length === 0) sectionsTableBody.innerHTML = '<tr><td colspan="5">No section data available.</td></tr>';
        else sections.forEach(sec => {
            const stats = sectionStats[sec] || { score: 0, correct: 0, incorrect: 0, unattempted: 0, total: 0, maxMarks: 0 };
            const secAttempted = stats.correct + stats.incorrect; const secAccuracy = secAttempted > 0 ? ((stats.correct / secAttempted) * 100) : 0;
            const secTimeSeconds = sectionTimesSeconds[sec] || 0; const secMaxMarks = stats.maxMarks || (stats.total * MARKS_CORRECT);
            const row = sectionsTableBody.insertRow(); const accClass = secAccuracy >= 80 ? 'good' : secAccuracy >= 50 ? 'medium' : 'bad';
            row.innerHTML = `<td>${sec}</td><td>${stats.score}/${secMaxMarks}</td><td><span class="accuracy-${accClass}">${secAccuracy.toFixed(1)}%</span></td><td>${secAttempted}/${stats.total}</td><td>${formatTime(secTimeSeconds)}</td>`;
        });

        // --- Populate Detailed Section Analysis Cards ---
        detailedSectionCardsContainer.innerHTML = '';
        if (sections.length === 0) detailedSectionCardsContainer.innerHTML = '<p>No detailed section analysis available.</p>';
        else sections.forEach(sec => {
            const stats = sectionStats[sec] || { score: 0, correct: 0, incorrect: 0, unattempted: 0, total: 0, maxMarks: 0 };
            const secTimeSeconds = sectionTimesSeconds[sec] || 0; const secAttempted = stats.correct + stats.incorrect;
            const secAccuracy = secAttempted > 0 ? ((stats.correct / secAttempted) * 100) : 0; const secTotalQuestions = stats.total || 0;
            const secMaxMarks = stats.maxMarks || (secTotalQuestions * MARKS_CORRECT); const accClass = secAccuracy >= 80 ? 'good' : secAccuracy >= 50 ? 'medium' : 'bad';
            const timeSpentFormatted = formatTotalTime(secTimeSeconds); // Use HH:MM:SS format
            const card = document.createElement('div'); card.className = 'card section-detail-card'; card.dataset.sectionName = sec;
            card.innerHTML = `<div class="section-card-header">${sec}</div><div class="section-card-body"><div class="stat-item"><span class="stat-label">Marks</span><span class="stat-value">${stats.score}/${secMaxMarks}</span></div><div class="stat-item"><span class="stat-label">Time</span><span class="stat-value">${timeSpentFormatted}</span></div><div class="stat-item"><span class="stat-label">Accuracy</span><span class="stat-value accuracy-${accClass}">${secAccuracy.toFixed(1)}%</span></div><div class="stat-item"><span class="stat-label">Attempted</span><span class="stat-value">${secAttempted}/${secTotalQuestions}</span></div></div><div class="advanced-analysis-links"><h5>Advanced Analysis</h5><div class="analysis-options"><button class="analysis-link" data-analysis-type="chapter" data-section="${sec}">Chapter <i class="fas fa-arrow-right"></i></button><button class="analysis-link" data-analysis-type="question_type" data-section="${sec}">Question Type <i class="fas fa-arrow-right"></i></button><button class="analysis-link" data-analysis-type="marks" data-section="${sec}">Marks <i class="fas fa-arrow-right"></i></button></div></div><div class="section-card-footer"><button class="btn-question-map" data-section="${sec}">QUESTION MAP</button><button class="btn-view-section-questions" data-section="${sec}">VIEW QUESTIONS</button></div>`;
            detailedSectionCardsContainer.appendChild(card);
        });

        // --- Switch Views ---
        selectAttemptMessage.style.display = 'none'; detailedResultsArea.style.display = 'none'; dashboardView.style.display = 'flex';

        // --- Scroll to Top ---
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } // --- End of displayDashboardView ---

    /**
     * Displays the detailed question review area, optionally filtered to a specific section.
     * @param {string | null} sectionNameToFocus - Section name or null for all (print).
     * @param {boolean} activateTabs - Whether to generate tabs.
     */
    function displayDetailedQuestionView(sectionNameToFocus = null, activateTabs = true) {
        // --- Validation ---
        if (!currentSelectedAttempt || !currentDetailedData || currentDetailedData.length === 0) { /* ... error handling ... */ return; }
        console.log(`Displaying detailed view. Focusing on section: ${sectionNameToFocus || 'First Available'}`);

        // --- Switch Views ---
        selectAttemptMessage.style.display = 'none'; dashboardView.style.display = 'none'; detailedResultsArea.style.display = 'block';

        // --- Update Timestamp ---
        const attemptDate = new Date(currentSelectedAttempt.timestamp || currentSelectedAttempt.id);
        attemptTimestampEl.textContent = `Attempt Time: ${isNaN(attemptDate) ? 'Unknown' : attemptDate.toLocaleString()}`;

        // --- Manage Section Tabs (if required) ---
        const sections = [...new Set(currentDetailedData.map(q => q.section).filter(Boolean))].sort(sortSectionsCustom);
        reviewSectionTabsContainer.innerHTML = '';
        if (activateTabs && sections.length > 0) {
            let firstSection = sections[0]; let targetSectionFound = false;
            sections.forEach((sec) => {
                const tab = document.createElement('button'); tab.className = 'review-section-tab'; tab.textContent = sec; tab.dataset.section = sec;
                if (sectionNameToFocus && sec === sectionNameToFocus) { tab.classList.add('active'); targetSectionFound = true; }
                else if (!sectionNameToFocus && sec === firstSection && !targetSectionFound) { tab.classList.add('active'); targetSectionFound = true; }
                tab.addEventListener('click', (e) => {
                    const clickedTab = e.target; reviewSectionTabsContainer.querySelectorAll('.review-section-tab').forEach(t => t.classList.remove('active'));
                    clickedTab.classList.add('active'); showDetailedReviewQuestions(clickedTab.dataset.section, currentDetailedData, true);
                }); reviewSectionTabsContainer.appendChild(tab);
            });
            const sectionToShowFirst = sectionNameToFocus && sections.includes(sectionNameToFocus) ? sectionNameToFocus : sections[0];
            showDetailedReviewQuestions(sectionToShowFirst, currentDetailedData, true);
        } else if (!activateTabs) showDetailedReviewQuestions(null, currentDetailedData, false); // Show all for print
        else { reviewSectionTabsContainer.innerHTML = '<p>No sections found.</p>'; reviewQuestionsContainer.innerHTML = '<p class="no-review-questions">No questions available.</p>'; }

        // --- Scroll to Top ---
        if (activateTabs) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Renders the list of questions into the review container.
     * @param {string | null} sectionName - Section to display, or null for all.
     * @param {Array} detailedData - Array of detailed question objects.
     * @param {boolean} onlyThisSection - True to filter by sectionName.
     */
    function showDetailedReviewQuestions(sectionName, detailedData, onlyThisSection = false) {
        let questionsToShow;
        if (onlyThisSection) questionsToShow = detailedData.filter(q => q.section === sectionName);
        else { // Show all (for print): Sort a *copy* by section order first, then original index
            console.log("Sorting all questions for display/print based on custom section order...");
            questionsToShow = [...detailedData].sort((qA, qB) => {
                const sectionComparison = sortSectionsCustom(qA.section || '', qB.section || '');
                if (sectionComparison !== 0) return sectionComparison;
                const indexA = detailedData.indexOf(qA); const indexB = detailedData.indexOf(qB); return indexA - indexB; // Fallback sort by original index
            });
        }
        reviewQuestionsContainer.innerHTML = '';
        if (questionsToShow.length === 0) { reviewQuestionsContainer.innerHTML = `<p class="no-review-questions">No questions found ${onlyThisSection ? `in the '${sectionName}' section` : 'in this attempt'}.</p>`; return; }

        let currentPrintSection = null;
        questionsToShow.forEach((q, loopIndex) => {
            if (!onlyThisSection && q.section !== currentPrintSection) {
                currentPrintSection = q.section; const header = document.createElement('h4');
                header.textContent = `Section: ${currentPrintSection || 'Uncategorized'}`; header.className = 'print-section-header'; reviewQuestionsContainer.appendChild(header);
            }
            const itemDiv = document.createElement('div'); itemDiv.className = 'review-question-item'; itemDiv.dataset.section = q.section;
            let correctAnsDisplay = q.correctAnswer ?? 'N/A'; let userAnsDisplay = 'N/A'; let userAnsClass = 'user-answer';
            if (q.type === 'mcq' && Array.isArray(q.options) && q.correctAnswer != null && q.options[q.correctAnswer] !== undefined) correctAnsDisplay = `(${String.fromCharCode(65 + parseInt(q.correctAnswer))}) ${q.options[q.correctAnswer]}`;
            else if (q.type === 'integer' && q.correctAnswer != null) correctAnsDisplay = q.correctAnswer;
            if (q.userAnswer === null || q.userAnswer === undefined || q.resultStatus === 'unattempted') userAnsDisplay = 'Not Answered';
            else if (q.type === 'mcq' && Array.isArray(q.options) && q.userAnswer != null && q.options[q.userAnswer] !== undefined) { userAnsDisplay = `(${String.fromCharCode(65 + parseInt(q.userAnswer))}) ${q.options[q.userAnswer]}`; if (q.resultStatus === 'incorrect') userAnsClass += ' incorrect-ans'; }
            else if (q.type === 'integer' && q.userAnswer != null) { userAnsDisplay = q.userAnswer; if (q.resultStatus === 'incorrect') userAnsClass += ' incorrect-ans'; }
            const resultStatusDisplay = q.resultStatus || 'unknown'; const statusClass = `review-status ${resultStatusDisplay}`; const displayQNum = loopIndex + 1;
            itemDiv.innerHTML = `<div class="question-number">Question ${displayQNum}${!onlyThisSection ? ` [${q.section || 'Unknown'}]` : ''} (ID: ${q.id || 'N/A'})</div><div class="question-text">${q.questionText || '[No Text]'}</div>${q.type === 'mcq' && Array.isArray(q.options)? `<div class="review-options">${q.options.map((opt, i) => `<div>(${String.fromCharCode(65+i)}) ${opt}</div>`).join('')}</div>` : ''}<div class="review-details"><div>Status: <span class="${statusClass}">${resultStatusDisplay.charAt(0).toUpperCase() + resultStatusDisplay.slice(1)}</span></div><div>Your Answer: <span class="${userAnsClass}">${userAnsDisplay}</span></div>${(resultStatusDisplay==='incorrect'||resultStatusDisplay==='unattempted')? `<div>Correct Answer: <span class="correct-answer">${correctAnsDisplay}</span></div>` : ''}<div>Marks: ${q.marksAwarded != null ? q.marksAwarded : 'N/A'}</div><div>Time Spent: ${formatTime(q.timeSpent || 0)}</div></div>${q.solution? `<div class="review-solution"><strong>Solution:</strong><div>${q.solution}</div></div>` : `<div class="review-solution"><strong>Solution:</strong><div>Not provided.</div></div>`}`;
            reviewQuestionsContainer.appendChild(itemDiv);
        });

        // --- Trigger MathJax Typesetting ---
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            console.log(`Requesting MathJax typesetting for ${onlyThisSection ? 'section: ' + sectionName : 'all questions'}`);
            MathJax.typesetPromise([reviewQuestionsContainer]).then(() => { console.log(`MathJax typesetting finished.`); }).catch((err) => console.error('MathJax typesetting error:', err));
        } else if (typeof MathJax === 'undefined') { console.warn(`MathJax not available. Typesetting skipped.`); }
        if (onlyThisSection) reviewQuestionsContainer.scrollTop = 0;
    }

    // --- Event Handlers ---
    function handleDetailedCardClick(event) {
        const target = event.target; const card = target.closest('.section-detail-card');
        if (!card || !currentSelectedAttempt) return; const sectionName = card.dataset.sectionName;
        if (target.classList.contains('btn-view-section-questions')) { console.log(`View Questions: ${sectionName}`); displayDetailedQuestionView(sectionName, true); }
        else if (target.classList.contains('btn-question-map')) { console.log(`Q Map: ${sectionName}`); alert(`Functionality 'Question Map' (Section: ${sectionName}) not implemented.`); }
        else if (target.closest('.analysis-link')) { const link = target.closest('.analysis-link'); const type = link.dataset.analysisType; console.log(`Analysis: ${type}, Section: ${sectionName}`); alert(`Functionality 'Advanced Analysis - ${type}' (Section: ${sectionName}) not implemented.`); }
    }

    /** Handles printing the DETAILED question view */
    function handlePrintButtonClick() {
        console.log("Detailed Print button clicked.");
        if (!currentDetailedData || currentDetailedData.length === 0) { alert("No detailed data to print."); return; }
        console.log("Rendering all questions for detail printing...");
        const activeTab = reviewSectionTabsContainer?.querySelector('.review-section-tab.active');
        const activeSectionName = activeTab?.dataset.section;
        document.body.classList.remove('printing-dashboard'); // Ensure correct print mode
        displayDetailedQuestionView(null, false); // Render all, sorted, no tabs
        setTimeout(() => {
            console.log("Calling window.print() for detailed view..."); window.print();
            setTimeout(() => {
                console.log("Attempting restore after detail print..."); const sections = [...new Set(currentDetailedData.map(q => q.section).filter(Boolean))].sort(sortSectionsCustom);
                const sectionToRestore = activeSectionName && sections.includes(activeSectionName) ? activeSectionName : sections[0];
                displayDetailedQuestionView(sectionToRestore, true); // Restore tabs
            }, 500);
        }, 500); // Delay for render, esp. MathJax
    }

    /** Handles printing the DASHBOARD summary view */
    function handlePrintDashboardClick() {
        console.log("Print Dashboard button clicked.");
        if (!currentSelectedAttempt) { alert("Please select an attempt first to print its dashboard."); return; }

        // --- ADDED ALERT ---
        alert("For printing all questions and answers, please go to 'View All Questions' first, then use the 'Print Results' button there.\n\nClick OK to print only the dashboard summary.");
        // Script pauses here

        document.body.classList.add('printing-dashboard'); // Add class for CSS targeting
        console.log("Added .printing-dashboard class to body.");
        setTimeout(() => {
            console.log("Calling window.print() for dashboard..."); window.print();
            setTimeout(() => { document.body.classList.remove('printing-dashboard'); console.log("Removed .printing-dashboard class from body."); }, 500);
        }, 250);
    }

    // --- Event Listener Setup ---
    if (detailedSectionCardsContainer) detailedSectionCardsContainer.addEventListener('click', handleDetailedCardClick); else console.warn("Detailed section cards container not found.");
    if (viewAllQuestionsBtn) viewAllQuestionsBtn.addEventListener('click', () => {
        if (currentSelectedAttempt) { const firstSection = [...new Set(currentDetailedData.map(q => q.section).filter(Boolean))].sort(sortSectionsCustom)[0]; displayDetailedQuestionView(firstSection, true); }
        else alert("Please select an attempt first.");
    }); else console.warn("View All Questions button not found.");
    if (backToDashboardBtn) backToDashboardBtn.addEventListener('click', () => {
        if (currentSelectedAttempt) displayDashboardView(currentSelectedAttempt);
        else { selectAttemptMessage.style.display = 'flex'; dashboardView.style.display = 'none'; detailedResultsArea.style.display = 'none'; }
    }); else console.warn("Back to Dashboard button not found.");
    if (printButton) printButton.addEventListener('click', handlePrintButtonClick); else console.warn("Detailed Print button (print-results-button) not found.");
    if (printDashboardBtn) printDashboardBtn.addEventListener('click', handlePrintDashboardClick); else console.warn("Print Dashboard button (print-dashboard-btn) not found.");

    // --- Initial Load ---
    loadAndFilterAttempts(); // Load and display attempt list

}); // --- End of DOMContentLoaded ---