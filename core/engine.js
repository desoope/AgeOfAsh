const Game = {
    state: {
        hp: 100,
        gold: 0,
        inventory: [],
        flags: {}, // Все твои "убил кузнеца", "спас вора"
        currentChapter: null,
        currentScene: null
    },
    
    config: {
        textSpeed: 30 // Скорость печати (мс)
    },

    // 1. Инициализация
    init: async function() {
        console.log("Engine Started");
        this.ui.playIntro([
            "Мир забыл свои имена...",
            "Огонь угасает...",
            "И только пепел помнит всё."
        ], () => {
            // После интро загружаем первую главу
            this.loadChapter("chapter_0_intro");
        });
    },

    // 2. Загрузка Главы (Модульность!)
    loadChapter: async function(chapterFolder) {
        try {
            // Подгружаем JSON данные
            const response = await fetch(`content/${chapterFolder}/data.json`);
            const chapterData = await response.json();
            
            this.currentChapterData = chapterData;
            
            // Подгружаем CSS главы, если есть
            const cssLink = document.getElementById('chapter-style');
            // Простая проверка (в реальности лучше проверять существование файла)
            cssLink.href = `content/${chapterFolder}/style.css`; 

            // Начинаем с первой сцены, указанной в JSON
            this.renderScene(chapterData.startScene);

        } catch (e) {
            console.error("Ошибка загрузки главы:", e);
            alert("Ошибка загрузки данных игры!");
        }
    },

    // 3. Отрисовка Сцены
    renderScene: function(sceneId) {
        const scene = this.currentChapterData.scenes[sceneId];
        if (!scene) return console.error(`Сцена ${sceneId} не найдена`);

        this.state.currentScene = sceneId;

        // 3.1 Логика авто-переходов (если сцена - это просто проверка условий)
        if (scene.type === "logic") {
            const nextScene = this.checkConditions(scene.next);
            this.renderScene(nextScene);
            return;
        }

        // 3.2 Картинка
        const imgBlock = document.getElementById('scene-image');
        if (scene.image) {
            imgBlock.style.backgroundImage = `url('content/${this.state.currentChapter}/${scene.image}')`;
            imgBlock.classList.add('active');
        } else {
            imgBlock.classList.remove('active');
        }

        // 3.3 Текст
        const textBlock = document.getElementById('story-text');
        textBlock.innerHTML = ""; // Очистка
        
        // Поддержка массива параграфов
        const paragraphs = Array.isArray(scene.text) ? scene.text : [scene.text];
        paragraphs.forEach(p => {
            const pTag = document.createElement('p');
            // Здесь можно добавить простую замену переменных, типа {{gold}}
            pTag.innerText = p; 
            textBlock.appendChild(pTag);
        });

        // 3.4 Кнопки выбора
        const choicesBox = document.getElementById('choices-box');
        choicesBox.innerHTML = "";
        
        if (scene.choices) {
            scene.choices.forEach(choice => {
                // Проверяем, должен ли выбор быть показан (req: {flag: true})
                if (choice.req && !this.checkRequirement(choice.req)) return;

                const btn = document.createElement('button');
                btn.className = 'choice-btn';
                btn.innerText = choice.text;
                btn.onclick = () => this.makeChoice(choice);
                choicesBox.appendChild(btn);
            });
        }
    },

    // 4. Обработка Выбора
    makeChoice: function(choice) {
        // Применяем эффекты (получить золото, задать флаг)
        if (choice.effect) {
            this.applyEffect(choice.effect);
        }

        // Если это переход в другую главу
        if (choice.nextChapter) {
            this.loadChapter(choice.nextChapter);
        } else {
            // Иначе просто следующая сцена
            this.renderScene(choice.next);
        }
    },

    // Вспомогательные функции
    applyEffect: function(effect) {
        if (effect.gold) this.state.gold += effect.gold;
        if (effect.hp) this.state.hp += effect.hp;
        if (effect.setFlag) this.state.flags[effect.setFlag] = true;
        
        this.ui.updateStats();
    },

    checkRequirement: function(req) {
        if (req.gold && this.state.gold < req.gold) return false;
        if (req.flag && !this.state.flags[req.flag]) return false;
        return true;
    },
    
    // Простейшая проверка условий для логических узлов
    checkConditions: function(logicObj) {
        // Пример: logicObj = { "if_guard_dead": "scene_tragic", "default": "scene_normal" }
        // Тут нужна более сложная логика парсинга, пока упростим:
        for (let key in logicObj) {
            if (key === "default") continue;
            if (this.state.flags[key]) return logicObj[key];
        }
        return logicObj.default;
    },

    ui: {
        updateStats: function() {
            document.getElementById('stat-gold').innerText = Game.state.gold;
            document.getElementById('stat-hp').innerText = Game.state.hp;
        },
        playIntro: function(lines, callback) {
            const container = document.getElementById('intro-text-container');
            let delay = 0;
            
            lines.forEach(line => {
                const div = document.createElement('div');
                div.className = 'intro-line';
                div.innerText = line;
                container.appendChild(div);
                
                setTimeout(() => div.classList.add('visible'), delay);
                delay += 2500; // Пауза между строками
            });

            setTimeout(() => {
                const btn = document.getElementById('start-btn');
                btn.classList.remove('hidden');
                btn.onclick = () => {
                    document.getElementById('intro-screen').classList.remove('active');
                    document.getElementById('game-screen').classList.add('active');
                    callback();
                };
            }, delay + 1000);
        }
    }
};

// Запуск при загрузке страницы
window.onload = () => Game.init();
