// Translations for zh (Chinese) and en (English)
// Usage: t.nav.home, t.home.hero.title, etc.

export type Lang = 'zh' | 'en';

export interface Translations {

    navbar: {
        goals: {
            noGoal: string;
            countdown: string;
            examDay: string;
            examPassed: string;
        }
    };
    nav: {
        home: string;
        practice: string;
        settings: string;
        prompts: string;
        collapse: string;
        vocab: string;
        sidebarTitle: string;
        store: string;
        workshop: string;
        feedback: string;
        notebook: string;
    };
    common: {
        back: string;
        confirm: string;
        cancel: string;
        save: string;
        saving: string;
        saved: string;
        error: string;
        loading: string;
        home: string;
        underline: string;
    };
    auth: {
        loginTitle: string;
        loginSubtitle: string;
        registerTitle: string;
        registerSubtitle: string;
        username: string;
        email: string;
        password: string;
        confirmPassword: string;
        loginBtn: string;
        loggingIn: string;
        registerBtn: string;
        registering: string;
        noAccount: string;
        hasAccount: string;
        toRegister: string;
        toLogin: string;
        backToHome: string;
        errorUnauthorized: string;
        errorGeneral: string;
        errorPasswordMismatch: string;
        errorRegisterTaken: string;
        verificationCode: string;
        codePlaceholder: string;
        sendCode: string;
        resendCode: string;
        codeSent: string;
        sendingCode: string;
        errorCodeInvalid: string;
        errorEmailRequired: string;
        errorBanned: string;
        manualTitle: string;
        manualSearch: string;
        manualEmpty: string;
        resetPasswordTitle: string;
        resetPasswordDesc: string;
        resetIdentifier: string;
        resetIdentifierPlaceholder: string;
        resetNewPassword: string;
        resetNewPasswordPlaceholder: string;
        resetSubmitBtn: string;
        resetSubmitting: string;
        resetSuccess: string;
        resetNotFound: string;
        resetTooShort: string;
        forgotPassword: string;
        backToLogin: string;
    };
    home: {
        hero: {
            title: string;
            subtitle: string;
            subsubtitle: string;
            startPractice: string;
            vocab: string;
        };
        skills: {
            heading: string;
            items: { title: string; desc: string; link: string }[];
        };
        howItWorks: {
            heading: string;
            steps: { title: string; desc: string }[];
        };
        announcements: {
            heading: string;
            items: { date: string; tag: string; content: string }[];
        };
        footer: string;
        footerFeedback: string;
        footerManual: string;
        checkin: {
            heading: string;
            todayLabel: string;
            totalLabel: string;
            rewardLabel: string;
            btnCheckin: string;
            btnChecking: string;
            btnDone: string;
            errorToast: string;
            milestoneHint: string;
            rules: string;
        };
    };
    practiceHub: {
        backToHome: string;
        heading: string;
        subheading: string;
        realPractice: {
            title: string;
            desc: string;
        };
        aiPractice: {
            title: string;
            desc: string;
        };
        comingSoon: string;
    };
    aiPractice: {
        backToPractice: string;
        heading: string;
        subheading: string;
        reading: {
            title: string;
            desc: string;
        };
        listening: {
            title: string;
            desc: string;
        };
        speaking: {
            title: string;
            desc: string;
        };
        writing: {
            title: string;
            desc: string;
        };
        others: {
            title: string;
            desc: string;
        };
        comingSoon: string;
    };
    readingConfig: {
        backToAI: string;
        heading: string;
        subheading: string;
        targetScore: string;
        questionType: {
            label: string;
            multipleChoice: {
                title: string;
                desc: string;
            };
            trueFalse: {
                title: string;
                desc: string;
            };
        };
        judgementMode: {
            label: string;
            easy: {
                title: string;
                desc: string;
            };
            normal: {
                title: string;
                desc: string;
            };
        };
        customVocab: {
            label: string;
            desc: string;
        };
        absurdMode: {
            label: string;
            desc: string;
        };
        startBtn: string;
        toast: {
            noVocab: string;
        };
    };
    speakingConfig: {
        backToAI: string;
        heading: string;
        subheading: string;
        vocabSettings: {
            title: string;
            desc: string;
        };
        ieltsPart: {
            title: string;
            lockedHint: string;
            parts: {
                part1: { title: string; desc: string };
                part2: { title: string; desc: string };
                part3: { title: string; desc: string };
            };
        };
        subtitles: {
            title: string;
            desc: string;
        };
        modes: {
            title: string;
            items: {
                chat: { title: string; desc: string };
                call: { title: string; desc: string };
                exam: { title: string; desc: string };
                scenario: { title: string; desc: string };
                fullTest: { title: string; desc: string };
            };
        };
        scenarioSettings: {
            title: string;
            desc: string;
            placeholder: string;
            randomBtn: string;
            generating: string;
        };
        scenarioSummary: {
            title: string;
            subtitle: string;
            overallScore: string;
            duration: string;
            vocabCoverage: string;
            backBtn: string;
            viewReport: string;
        };
        startBtn: string;
        comingSoon: string;
    };
    listeningConfig: {
        backToAI: string;
        heading: string;
        subheading: string;
        practiceType: {
            label: string;
            article: { title: string; desc: string };
            sentence: { title: string; desc: string };
            multipleChoice: { title: string; desc: string };
            mapLabelling: { title: string; desc: string };
        };
        targetScore: string;
        wordCount: {
            label: string;
            min: string;
            max: string;
            sep: string;
            word: string;
            hintExact: string;
            hintRange: string;
        };
        customVocab: {
            label: string;
            desc: string;
        };
        absurdMode: {
            label: string;
            desc: string;
        };
        startBtn: string;
        toast: {
            noVocab: string;
        };
    };
    writingHub: {
        backToPractice: string;
        heading: string;
        subheading: string;
        practiceMode: string;
        correction: {
            title: string;
            desc: string;
        };
        task1: {
            title: string;
            desc: string;
        };
        task2: {
            title: string;
            desc: string;
        };
        opinionDrill: {
            title: string;
            desc: string;
        };
        typingChat: {
            title: string;
            desc: string;
        };
        perspective: {
            title: string;
            desc: string;
        };
    };
    writingPerspective: {
        heading: string;
        subheading: string;
        backToHall: string;
        inputTitle: string;
        inputDesc: string;
        placeholder: string;
        analyzeBtn: string;
        analyzingBtn: string;
        loadingTitle: string;
        loadingDesc: string;
        emptyTitle: string;
        emptyDesc: string;
        goodBadge: string;
        goodTitle: string;
        badBadge: string;
        badTitle: string;
        reasonLabel: string;
        expandBtn: string;
        collapseBtn: string;
        ideaLabel: string;
        explainLabel: string;
        exampleLabel: string;
        toastEmptyTopic: string;
        toastSuccess: string;
        toastError: string;
        examplesTitle: string;
        example1: string;
        example2: string;
        example3: string;
    };
    task1Selection: {
        backToWriting: string;
        heading: string;
        subheading: string;
        types: {
            chart: { title: string; nameEn: string; desc: string };
            map: { title: string; nameEn: string; desc: string };
            flowchart: { title: string; nameEn: string; desc: string };
            random: { title: string; nameEn: string; desc: string };
        };
        beta: string;
        startBtn: string;
        comingSoon: string;
    };
    chartSelection: {
        backToHub: string;
        heading: string;
        subheading: string;
        types: {
            line: { title: string; nameEn: string };
            pie: { title: string; nameEn: string };
            bar: { title: string; nameEn: string };
            horizontal: { title: string; nameEn: string };
            table: { title: string; nameEn: string };
            mixed: { title: string; nameEn: string };
            random: { title: string; nameEn: string };
        };
        startBtn: string;
    };
    task2Selection: {
        backToWriting: string;
        heading: string;
        subheading: string;
        topicLabel: string;
        topicHint: string;
        topics: {
            all: string;
            education: string;
            technology: string;
            culture: string;
            urbanization: string;
            government: string;
            environment: string;
            media: string;
            society: string;
            abstract: string;
            random: string;
            innovation: string;
        };
        types: {
            opinion: { title: string; nameEn: string; desc: string };
            report: { title: string; nameEn: string; desc: string };
            mixed: { title: string; nameEn: string; desc: string };
            random: { title: string; nameEn: string; desc: string };
            innovation: { title: string; nameEn: string; desc: string };
        };
        startBtn: string;
    };
    task2OpinionSelection: {
        backToTask2Selection: string;
        heading: string;
        subheading: string;
        types: {
            agree: { title: string; nameEn: string; desc: string };
            discuss: { title: string; nameEn: string; desc: string };
            advantages: { title: string; nameEn: string; desc: string };
            random: { title: string; nameEn: string; desc: string };
        };
        startBtn: string;
    };
    task2OpinionDrill: {
        backToTask2Selection: string;
        backToSetup: string;
        heading: string;
        subheading: string;
        countLabel: string;
        countHint: string;
        categoriesLabel: string;
        randomHint: string;
        startBtn: string;
        generatingTitle: string;
        generatingDesc: string;
        progress: string;
        questionLabel: string;
        answerLabel: string;
        answerPlaceholder: string;
        submitBtn: string;
        evaluatingTitle: string;
        currentResultTitle: string;
        nextQuestionBtn: string;
        viewSummaryBtn: string;
        summaryTitle: string;
        summaryDesc: string;
        overallAvg: string;
        grammar: string;
        relevance: string;
        vocabulary: string;
        feedback: string;
        referenceAnswer: string;
        restartBtn: string;
        backBtn: string;
        emptyAnswer: string;
        startFail: string;
        evalFail: string;
        countRangeError: string;
        missingConfig: string;
        wordCount: string;
        categories: {
            education: string;
            technology: string;
            culture: string;
            urbanization: string;
            government: string;
            environment: string;
            media: string;
            society: string;
            abstract: string;
            random: string;
        };
    };
    practiceSandbox: {
        loadingDescTask1: string;
        loadingDescTask2: string;
        loadingTitleTask1: string;
        loadingTitleTask2: string;
        promptTitle: string;
        yourAnswer: string;
        placeholderTask1: string;
        placeholderTask2: string;
        finishBtn: string;
        settlementTitle: string;
        settlementDesc: string;
        congratsTask1: string;
        congratsTask2: string;
        wordsWrittenStart: string;
        wordsWrittenEnd: string;
        persistTask1: string;
        persistTask2: string;
        callAiBtn: string;
        backBtn: string;
        evaluatingTitle: string;
        evaluatingDesc: string;
        evaluatingDescLine2: string;
        overallBand: string;
        backToPracticeBtn: string;
        taTask1: string;
        taTask2: string;
        cc: string;
        lr: string;
        gra: string;
        examinerReport: string;
        reviewOriginal: string;
        reviewAndAnswer: string;
        overallBandSubtitle: string;
        abortBtn: string;
        titleTask1: string;
        titleTask2: string;
        toastEmpty: string;
        toastTooShortTask1: string;
        toastTooShortTask2: string;
        toastSuccess: string;
        toastFailGenChart: string;
        toastFailGenTask2: string;
        toastFailEval: string;
        wordCountBadgeTask1: string;
        wordCountBadgeTask2: string;
        wordCountWords: string;
        typeFallback: string;
    };
    writingAiTeacher: {
        hubTitle: string;
        hubDesc: string;
        genTitle: string;
        genSubtitle: string;
        genPlaceholder: string;
        genBtn: string;
        lessonTitle: string;
        sectionNames: string[];
        loading: string;
        loadingSteps: string[];
        download: string;
        prev: string;
        next: string;
        badExample: string;
        fullEssay: string;
        sectionSummary: string;
        errorGen: string;
        errorTopic: string;
    };
    writingCorrection: {
        toastEmpty: string;
        toastSuccess: string;
        toastFail: string;
        toastErrorTitle: string;
        backToHall: string;
        title: string;
        subtitle: string;
        yourEssay: string;
        wordCount: string;
        placeholder: string;
        evaluatingBtn: string;
        evaluateBtn: string;
        overallBand: string;
        overallBandSubtitle: string;
        taTask1: string;
        ta: string;
        cc: string;
        lr: string;
        gra: string;
        examinerFeedback: string;
        promptLabel: string;
        promptPlaceholder: string;
        optionalTag: string;
        task1Btn: string;
        task2Btn: string;
        modelEssayTitle: string;
        modelEssayBadge: string;
        copyBtn: string;
        copiedBtn: string;
        evaluatingTitle: string;
        evaluatingDesc: string;
        pendingTitle: string;
        pendingDesc: string;
        task1ImageLabel: string;
        task1ImageHint: string;
        task1ImageDropHint: string;
        task1ImageSelectBtn: string;
        task1ImageReplaceBtn: string;
        task1ImageRemoveBtn: string;
        task1ImagePreviewAlt: string;
        task1ImageVisionOnlyHint: string;
        task1ImageInvalidType: string;
        task1ImageTooLarge: string;
        task1ImageReadFail: string;
        task1ImageModelSupportYes: string;
        task1ImageModelSupportNo: string;
    };
    settings: {
        heading: string;
        subheading: string;
        language: {
            title: string;
            label: string;
            desc: string;
        };
        model: {
            title: string;
            label: string;
            desc: string;
        };
        aiRetry: {
            saveSuccess: string;
            saveFailed: string;
            aiRetryCount: string;
            aiRetryDesc: string;
            aiRetryLabel: string;
            aiRetryUnit: string;
            importantNotice: string;
            notice1: string;
            notice2: string;
            notice3: string;
            notice4: string;
            notice5: string;
            saveBtn: string;
        };
        system: {
            title: string;
            userId: string;
            registeredTime: string;
            emailVerify: string;
            verified: string;
            notVerified: string;
        };
        avatar: {
            title: string;
            description: string;
        };
        movedMessage: string;
        goToProfile: string;
    };
    profile: {
        heading: string;
        subheading: string;
        menu: {
            home: string;
            analytics: string;
            settings: string;
            backpack: string;
            finance: string;
            style: string;
            background: string;
            admin: string;
            manual: string;
        };
        welcome: string;
        welcomeDesc: string;
        timeFormat: {
            day: string;
            hour: string;
            minute: string;
            second: string;
        };
        finance: {
            title: string;
            subtitle: string;
            totalAtUsed: string;
            totalCnyUsed: string;
            dailyTrend: string;
            atCoin: string;
            cny: string;
            barChart: string;
            lineChart: string;
            consumeAt: string;
            consumeCny: string;
            noData: string;
            transactionDetails: string;
            time: string;
            description: string;
            amount: string;
            balanceAfter: string;
            noTransactions: string;
            prevPage: string;
            pageOf: string;
            nextPage: string;
        };
        accessDeniedTitle: string;
        accessDeniedDesc: string;
        backToHome: string;
        info: {
            title: string;
            username: string;
            email: string;
            created: string;
            lastLogin: string;
            todayLearningTime: string;
        };
        balance: {
            title: string;
            description: string;
            recharge: string;
            history: string;
        };
        quickAccess: {
            title: string;
            practice: string;
            stats: string;
            targets: string;
            history: string;
            backpack: string;
        };
        account: {
            title: string;
            description: string;
            logout: string;
            delete: string;
            deleting: string;
            warning: string;
            confirmDelete: string;
        };
        home: {
            vocabTotal: string;
            calendar: {
                yearSummary: string;
                cumulativeDays: string;
                consecutive: string;
                pastYear: string;
                months: string[];
                dayLabels: string[];
                tooltip: {
                    noActivity: string;
                    studied: string;
                    checkedIn: string;
                    vocab: string;
                    reading: string;
                    listening: string;
                    speaking: string;
                    writing: string;
                };
                legend: {
                    labels: string[];
                };
            };
            plans: {
                empty: string;
                createFirst: string;
                today: string;
                studied: string;
                words: string;
                viewAll: string;
            };
        };
        rename: {
            title: string;
            cost: string;
            placeholder: string;
            confirmBtn: string;
            processing: string;
            errors: {
                tooShort: string;
                tooLong: string;
                invalidChars: string;
                sameName: string;
                confirmMsg: string;
                fail: string;
            };
        };
        backpack: {
            empty: string;
            emptyHint: string;
        };
        feedback: {
            title: string;
            desc: string;
            email: string;
            message: string;
            submit: string;
            success: string;
            placeholderTitle: string;
            placeholderDesc: string;
            backToSubmit: string;
        };
        avatarHint: string;
        avatarUpload: {
            fileValidationError: string;
            uploadSuccess: string;
            uploadFailed: string;
            deleteConfirm: string;
            deleteSuccess: string;
            deleteFailed: string;
            avatarAlt: string;
            uploading: string;
            clickToChange: string;
            deleteBtn: string;
            hint: string;
        };
        background: {
            title: string;
            desc: string;
            colorSection: string;
            colorDesc: string;
            imageSection: string;
            imageDesc: string;
            blurSection: string;
            blurDesc: string;
            blurClear: string;
            blurBlurry: string;
            tabUrl: string;
            tabUpload: string;
            urlPlaceholder: string;
            preview: string;
            uploading: string;
            uploadPlaceholder: string;
            uploadSuccess: string;
            clearBtn: string;
            saveTitle: string;
            saveAutoHint: string;
            presets: {
                white: string;
                beige: string;
                mint: string;
                blue: string;
                violet: string;
                morning: string;
                green: string;
                dusk: string;
                sky: string;
                coral: string;
            };
        };
        admin: {
            feedback: {
                title: string;
                unresolved: string;
                resolved: string;
                resolve: string;
                delete: string;
                noData: string;
                total: string;
            };
            users: {
                title: string;
                subtitle: string;
                totalUsers: string;
                pageUsers: string;
                filtered: string;
                pageAdmins: string;
                pageBanned: string;
                searchPlaceholder: string;
                filterAll: string;
                filterNormal: string;
                filterAdmin: string;
                filterBanned: string;
                loading: string;
                empty: string;
                noMatch: string;
                badgeBanned: string;
                badgeNormal: string;
                badgeAdmin: string;
                badgeEmailVerified: string;
                labelEmail: string;
                labelAtBalance: string;
                labelRegistered: string;
                labelLastLogin: string;
                labelNotProvided: string;
                neverLogin: string;
                btnBan: string;
                btnUnban: string;
                btnAdjustAt: string;
                btnDelete: string;
                toastLoadFail: string;
                toastAdminNoBan: string;
                toastBanSuccess: string;
                toastUnbanSuccess: string;
                toastOpFail: string;
                toastAdminNoDelete: string;
                toastDeleteConfirm: string;
                toastDeleteSuccess: string;
                toastDeleteFail: string;
                toastInvalidAmount: string;
                toastAdjustSuccess: string;
                toastAdjustFail: string;
                toastInvalidPage: string;
                toastEnterPage: string;
            };
            pagination: {
                jumpTo: string;
                pagePlaceholder: string;
                goBtn: string;
            };
            routes: {
                title: string;
            };
        };
    };
    readingDetails: {
        dictionary: string;
        questions: string;
        questionsMcq: string;
        questionsTrueFalseEasy: string;
        questionsTrueFalseNormal: string;
        time: string;
        hideTargets: string;
        showTargets: string;
        submitConfirm: string;
        writingPassage: string;
        searchPlaceholder: string;
        underline: string;
        submitBtn: string;
        absurdMode: string;
        absurdModeOn: string;
        absurdModeOff: string;
    };
    listeningDetails: {
        startAudio: string;
        speaking: string;
        audioDone: string;
        typeArticle: string;
        typeSentence: string;
        typeMC: string;
        wordLimit: string;
        generatingAudio: string;
        audioError: string;
        noQuestions: string;
        writingPassage: string;
        wordUnit: string;
        typeMap: string;
        selectOption: string;
        mapInstructions: string;
    };
    results: {
        analysis: string;
        originalPassage: string;
        hidePassage: string;
        showPassage: string;
        targetVocab: string;
        yourAnswer: string;
        correctAnswer: string;
        acceptableAnswers: string;
        statusCorrect: string;
        statusIncorrect: string;
        explanation: string;
    };
    components: {
        vocabInput: {
            label: string;
            invalidLines: string;
            placeholder: string;
            formatDesc: string;
            toastHint: string;
        };
        aiModel: {
            label: string;
            desc: string;
        };
        toast: {
            errorTitle: string;
        };
    };
    billing: {
        insufficientBalance: string;
        checkingBalance: string;
        estimateCost: string;
        currentBalance: string;
        goToRecharge: string;
        tryAnyway: string;
        consumedToast: string;
        refundToast: string;
        needMoreBalance: string;
    };
    creativeWorkshop: {
        title: string;
        subtitle: string;
        pageTitleLabel: string;
        pageTitlePlaceholder: string;
        methodLabel: string;
        methodPlaceholder: string;
        methodRequired: string;
        generateBtn: string;
        generatingBtn: string;
        generateSuccess: string;
        generateFail: string;
        myPagesTitle: string;
        emptyPages: string;
        openPage: string;
        favoriteBtn: string;
        unfavoriteBtn: string;
        favoriteSuccess: string;
        unfavoriteSuccess: string;
        favoriteFail: string;
        goToFavorites: string;
        favoritesTitle: string;
        favoritesSubtitle: string;
        backToHome: string;
        emptyFavorites: string;
        updatedAt: string;
        totalPages: string;
        totalFavorites: string;
        invalidProject: string;
        loadDetailFail: string;
        previewTitle: string;
        previewSubtitle: string;
        loadFail: string;
        deleteBtn: string;
        deleteConfirm: string;
        deleteSuccess: string;
        deleteFail: string;
    };
    store: {
        fetchFail: string;
        addSuccess: string;
        addFail: string;
        opFail: string;
        deleteFail: string;
        checkoutSuccess: string;
        checkoutFail: string;
        balance: string;
        cart: string;
        loading: string;
        addToCart: string;
        adding: string;
        cartTitle: string;
        storeName: string;
        cartInfo: string;
        cartEmpty: string;
        colProduct: string;
        colQuantity: string;
        colPrice: string;
        colSubtotal: string;
        colAction: string;
        btnDecrease: string;
        btnIncrease: string;
        btnRemoveItem: string;
        btnDelete: string;
        total: string;
        thanks: string;
        totalLabel: string;
        checkoutFree: string;
        checkoutPay: string;
    };
    vocab: {
        modes: {
            flashcard: string;
            choice: string;
            write: string;
            copy: string;
            gaze: string;
        };
        flashcardTracking: {
            eye: string;
            mouse: string;
            none: string;
        };
        gaze: {
            calibrating: string;
            scanPrompt: string;
            scanComplete: string;
            notSupported: string;
            cameraDenied: string;
            recalibrate: string;
            trackingEye: string;
            trackingMouse: string;
            switchToMouse: string;
            switchToEye: string;
        };
        ratings: {
            again: string;
            hard: string;
            good: string;
            easy: string;
        };
        status: {
            new: string;
            learning: string;
            review: string;
            relearn: string;
        };
        nextReview: string;
        intervals: {
            today: string;
            tomorrow: string;
            minsAfter: string;
            daysAfter: string;
            daysUnit: string;
            toSync: string;
            approx: string;
        };
        toastSyncFail: string;
        resultTitle: string;
        masteredCount: string;
        reviewDetail: string;
        retry: string;
        studyTitle: string;
        reviewMode: string;
        queue: string;
        repsDone: string;
        lapsesCount: string;
        stability: string;
        tapToFlip: string;
        ratingHint: string;
        know: string;
        dontKnow: string;
        hide: string;
        next: string;
        charsCount: string;
        writePlaceholder: string;
        copyPlaceholder: string;
        submit: string;
        undo: string;
        correctLabel: string;
        wrongLabel: string;
        copiedLabel: string;
        exitConfirm: string;
        plans: {
            title: string;
            subtitle: string;
            newPlan: string;
            maxPlansHint: string;
            emptyTitle: string;
            emptySub: string;
            cardDaily: string;
            cardTotal: string;
            cardStudied: string;
            editPlan: string;
            startStudy: string;
            startReview: string;
            preparing: string;
            modalTitle: string;
            planNameLabel: string;
            planNamePlaceholder: string;
            dailyCountLabel: string;
            createBtn: string;
            creatingBtn: string;
            msgLoadFail: string;
            msgNameRequired: string;
            msgDailyRange: string;
            msgCreateSuccess: string;
            msgCreateFail: string;
            msgDeleteConfirm: string;
            msgDeleteSuccess: string;
            msgDeleteFail: string;
            msgStartFail: string;
            msgEmptyWord: string;
            msgNoReviewRecord: string;
            msgDailyGoalReached: string;
            msgNoDueReview: string;
            btnDelete: string;
        };
        details: {
            title: string;
            addWords: string;
            tabManual: string;
            tabNotebook: string;
            tabBook: string;
            manualWord: string;
            manualZh: string;
            manualPhonetic: string;
            manualGrammar: string;
            manualDuplicate: string;
            manualAddBtn: string;
            nbSelect: string;
            nbImportAll: string;
            nbImporting: string;
            bookSelect: string;
            bookModeAll: string;
            bookModeRange: string;
            bookModeSelect: string;
            bookRangeIdx: string;
            bookImportSelected: string;
            bookPrevPage: string;
            bookNextPage: string;
            listTitle: string;
            listSearch: string;
            listEmpty: string;
            listNoMatch: string;
            sortLabel: string;
            sortDefault: string;
            sortAlpha: string;
            sortProf: string;
            sortAsc: string;
            sortDesc: string;
            dailyPrefix: string;
            dailySuffix: string;
            modeLabel: string;
            todayTitle: string;
            btnCollapseEx: string;
            btnExpandEx: string;
            pageInfo: string;
            prevPage: string;
            nextPage: string;
            msgLoadFail: string;
            msgSaveSuccess: string;
            msgSaveFail: string;
            msgDailyRange: string;
            msgDailySaveSuccess: string;
            msgWordEmpty: string;
            msgDuplicate: string;
            msgAddSuccess: string;
            msgAddFail: string;
            msgImportSuccess: string;
            msgImportSuccessSkip: string;
            msgImportFail: string;
            msgUpdateSuccess: string;
            msgUpdateFail: string;
            msgDaysInvalid: string;
            msgDeleteConfirm: string;
            msgDeleteSuccess: string;
            msgDeleteFail: string;
            msgPlanNotFound: string;
            msgPlanConflict: string;
            msgNetworkErr: string;
            msgInsufficientAT: string;
        };
        hub: {
            title: string;
            desc: string;
            practiceTitle: string;
            practiceDesc: string;
            plansTitle: string;
            plansDesc: string;
            notebookTitle: string;
            notebookDesc: string;
            booksTitle: string;
            booksDesc: string;
        };
        notebooks: {
            title: string;
            desc: string;
            btnCreate: string;
            maxLimitHint: string;
            emptyTitle: string;
            cardWordCount: string;
            cardPublic: string;
            modalCreateTitle: string;
            modalEditTitle: string;
            modalTitleLabel: string;
            modalTitlePlaceholder: string;
            modalDescLabel: string;
            modalDescPlaceholder: string;
            modalColorLabel: string;
            btnCancel: string;
            btnSave: string;
            msgDeleteConfirm: string;
            msgTitleRequired: string;
            msgCreateSuccess: string;
            msgSaveSuccess: string;
            msgDeleteSuccess: string;
            msgFail: string;
        };
        notebookDetail: {
            titleDefault: string;
            desc: string;
            searchPlaceholder: string;
            btnAddWord: string;
            btnCollapse: string;
            clearFilter: string;
            tabManual: string;
            tabBook: string;
            wordCount: string;
            filteredCount: string;
            emptyList: string;
            emptySearch: string;
            modalAddTitle: string;
            modalEditTitle: string;
            wordLabel: string;
            wordPlaceholder: string;
            zhLabel: string;
            zhPlaceholder: string;
            phoneticLabel: string;
            phoneticPlaceholder: string;
            grammarLabel: string;
            grammarPlaceholder: string;
            tagLabel: string;
            tagPlaceholder: string;
            tagHint: string;
            masteryLabel: string;
            masteryUnrated: string;
            masteryRating: string;
            notesLabel: string;
            notesPlaceholder: string;
            msgDuplicate: string;
            btnAdd: string;
            btnCancel: string;
            btnSave: string;
            bookSelect: string;
            bookModeAll: string;
            bookModeRange: string;
            bookModeSelect: string;
            bookImportSelected: string;
            bookRangeIdx: string;
            bookPrevPage: string;
            bookNextPage: string;
        };
        books: {
            title: string;
            desc: string;
            emptyTitle: string;
        };
        bookDetail: {
            titleDefault: string;
            searchPlaceholder: string;
            emptyTitle: string;
            emptySearch: string;
            pagerTemplate: string;
            wordCount: string;
            prevPage: string;
            nextPage: string;
        };
    };
    writingChatConfig: {
        backToWriting: string;
        heading: string;
        subheading: string;
        vocabSettings: {
            title: string;
            desc: string;
        };
        startBtn: string;
        planImportPlaceholder: string;
        planImporting: string;
        planImportBtn: string;
        planNoWords: string;
        planImportFailed: string;
        planImportSuccess: string;
        planImportSkipped: string;
    };
    writingChat: {
        backToConfig: string;
        targetVocab: string;
        typePlaceholder: string;
        sendBtn: string;
        grammarScore: string;
        vocabScore: string;
        relevanceScore: string;
        generating: string;
        correctedVersion: string;
        clearChat: string;
        endSummary: string;
        summaryTitle: string;
        summarizing: string;
        searchVocab: string;
        hideScores: string;
        viewScores: string;
        attachFiles: string;
    };
    analytics: {

        skillsAvg: {
            task1: string;
            task2: string;
            target: string;
        };
        title: string;
        subtitle: string;
        comingSoon: string;
        selectBook: string;
        wordsUnit: string;
        totalWords: string;
        studiedWords: string;
        studyRate: string;
        noData: string;
        forgettingCurve: string;
        forgettingCurveDay: string;
        scheduledDist: string;
        masteryDist: string;
        vocabTab: string;
        listeningTab: string;
        speakingTab: string;
        readingTab: string;
        writingTab: string;
        today: string;
        days: string;
        overdue: string;
        daysLater: string;
        states: {
            new: string;
            learning: string;
            review: string;
            relearning: string;
        };
    };
    markdownNotes: {
        title: string;
        newNote: string;
        searchPlaceholder: string;
        emptyList: string;
        noNotesYet: string;
        unsaved: string;
        sidebarCount: string;
        titlePlaceholder: string;
        saveToCloud: string;
        saving: string;
        deleteNote: string;
        deleteConfirm: string;
        deleteSuccess: string;
        deleteFail: string;
        createFail: string;
        loadFail: string;
        saveFail: string;
        savedToCloud: string;
        selectNote: string;
    };
    chromeOnlyGuard: {
        warningTitle: string;
        warningDesc: string;
        copyUrl: string;
    };
    assistant: {
        title: string;
        openAria: string;
        collapseTitle: string;
        collapseAria: string;
        screenshotTitle: string;
        screenshotAria: string;
        switchLangTitleEn: string;
        switchLangTitleZh: string;
        switchLangBtnEn: string;
        switchLangBtnZh: string;
        actions: {
            translate: string;
            personalAgent: string;
            rewrite: string;
            summarize: string;
            checkin: string;
            checkinDone: string;
            checking: string;
            todoList: string;
            shortcuts: string;
        };

        shortcuts: {
            heading: string;
            addBtn: string;
            titlePlaceholder: string;
            urlPlaceholder: string;
            empty: string;
            deleteAria: string;
            invalidUrl: string;
            newTabLabel: string;
        };
        translate: {
            sourceLang: string;
            targetLang: string;
            swapTitle: string;
            swapAria: string;
            sourceText: string;
            speakSourceTitle: string;
            speakSourceAria: string;
            startVoiceTitle: string;
            stopVoiceTitle: string;
            inputPlaceholder: string;
            translating: string;
            translateBtn: string;
            translatedText: string;
            speakTranslatedTitle: string;
            speakTranslatedAria: string;
            outputPlaceholder: string;
            toastEmpty: string;
            toastSameLang: string;
            toastSuccess: string;
            toastFail: string;
        };
        agent: {
            tip: string;
            collapseConfig: string;
            expandConfig: string;
            clearChat: string;
            nameLabel: string;
            namePlaceholder: string;
            roleLabel: string;
            rolePlaceholder: string;
            goalLabel: string;
            goalPlaceholder: string;
            styleLabel: string;
            stylePlaceholder: string;
            saveConfig: string;
            thinkingTitle: string;
            thinkingInit: string;
            emptyChat: string;
            you: string;
            fallbackName: string;
            collapseMsg: string;
            expandMsg: string;
            thinking: string;
            inputPlaceholder: string;
            replying: string;
            send: string;
            toastEmptyProfile: string;
            toastProfileSaved: string;
            toastProfileSaveFail: string;
            toastChatCleared: string;
            toastReplyFail: string;
            toastNoReply: string;
            stepObsSuccess: string;
            stepObsFail: string;
            stepAction: string;
            stepObservation: string;
            stepFinal: string;
            stepError: string;
            routeReason: string;
            routeOpenPagesDisabled: string;
            defaultProfile: {
                name: string;
                role: string;
                goal: string;
                style: string;
            };
        };
        speech: {
            noMicPermission: string;
            noSpeech: string;
            micUnavailable: string;
            networkError: string;
            genericError: string;
        };
        screenshot: {
            toastGenerateFail: string;
            toastSaved: string;
            toastFail: string;
        };
        checkin: {
            failMessage: string;
            balance: string;
            totalCheckins: string;
            daysUnit: string;
            comeBack: string;
        };
        voice: {
            noText: string;
        };
        todo: {
            title: string;
            inputPlaceholder: string;
            addBtn: string;
            empty: string;
            deleteAria: string;
            remaining: string;
            cleared: string;
        };
    };
}

import { zh } from './translations.zh';
import { en } from './translations.en';

export const translations: Record<Lang, Translations> = { zh, en };

