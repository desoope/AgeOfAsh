const Game = {
    state: {
        hp: 100,
        gold: 0,
        cold: 0,
        inventory: [],
        skills: {
            "strength": 1,
            "stealth": 0,
            "eloquence": 0
        },
        flags: {}, 
        currentChapter: null,
        lore: [] // Записи журнала
    },

    // 1. Инициализация и Интро
    init: function() {
        // Титры
        this.ui.playIntroSequence([
            "Мир трещит по швам...",
            "Боги оставили нас...",
            "Добро пожаловать в Эпоху Пепла."
        ], () => {
            // Переход к Лору
            document.getElementById('intro-screen').classList.remove('active');
            document.getElementById('lore-screen').classList.add('active');
            
            // Печатаем предысторию
            const loreText = "За двести лет до твоего рождения Солнце начало остывать. Великие королевства пали, превратившись в замерзшие руины. Ныне миром правят те, у кого есть огонь и сталь. Ты — один из немногих выживших, ищущий свое предназначение в этом умирающем мире...";
            
            this.ui.typeText('lore-text-typing', loreText, 20, () => {
                document.getElementById('to-game-btn').classList.remove('hidden-btn');
            });
        });

        // Кнопка перехода в игру
        document.getElementById('to-game-btn').onclick = () => {
            document.getElementById('lore-screen').classList.remove('active');
            document.getElementById('game-screen').classList.add('active');
            this.loadChapter("chapter_0_intro");
        };
    },

    // 2. Загрузка Главы
    loadChapter: async function(chapterFolder) {
        try {
            const response = await fetch(`content/${chapterFolder}/data.json`);
            this.currentChapterData = await response.json();
            this.state.currentChapter = chapterFolder;
            
            // Если есть стили главы
            document.getElementById('chapter-style').href = `content/${chapterFolder}/style.css`; 
            
            this.renderScene(this.currentChapterData.startScene);
        } catch (e) {
            console.error(e);
            alert("Ошибка: Глава не найдена");
        }
    },

    // 3. Рендер Сцены (с историей и печатной машинкой)
    renderScene: function(sceneId) {
        const scene = this.currentChapterData.scenes[sceneId];
        
        // --- 3.1 Обработка Истории ---
        // Берем текущий активный текст и отправляем его в "историю"
        const activeBlock = document.getElementById('active-scene');
        const historyLog = document.getElementById('history-log');
        const oldText = document.getElementById('typing-text').innerHTML;
        
        // Если это не первая сцена (есть старый текст)
        if (oldText) {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-block';
            historyItem.innerHTML = oldText; // Копируем текст
            
            // Если был выбор, можно добавить пометку, что выбрал игрок (сложно, пока пропустим)
            historyLog.appendChild(historyItem);
        }

        // --- 3.2 Подготовка новой сцены ---
        const imgBlock = document.getElementById('scene-image');
        const textBlock = document.getElementById('typing-text');
        const choicesBox = document.getElementById('choices-box');

        // Картинка
        if (scene.image) {
            imgBlock.style.backgroundImage = `url('content/${this.state.currentChapter}/${scene.image}')`;
            imgBlock.classList.add('active');
        } else {
            imgBlock.classList.remove('active');
        }

        // Очистка кнопок (они появятся после печати текста)
        choicesBox.innerHTML = ""; 
        textBlock.innerHTML = ""; // Очистка поля для печати

        // Сборка текста из массива
        let fullText = Array.isArray(scene.text) ? scene.text.join("<br><br>") : scene.text;

        // --- 3.3 Эффект Печатной Машинки ---
        this.ui.typeText('typing-text', fullText, 15, () => {
            // КОГДА ПЕЧАТЬ ЗАКОНЧИЛАСЬ -> РИСУЕМ КНОПКИ
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    if (choice.req && !this.checkRequirement(choice.req)) return;

                    const btn = document.createElement('button');
                    btn.className = 'choice-btn';
                    btn.innerText = choice.text;
                    btn.onclick = () => this.makeChoice(choice);
                    choicesBox.appendChild(btn);
                });
            }
            // Авто-скролл вниз
            const scrollArea = document.getElementById('story-scroll-area');
            scrollArea.scrollTop = scrollArea.scrollHeight;
        });
    },

    // 4. Логика выбора
    makeChoice: function(choice) {
        if (choice.effect) this.applyEffect(choice.effect);
        
        if (choice.nextChapter) {
            this.loadChapter(choice.nextChapter);
        } else {
            this.renderScene(choice.next);
        }
    },

    applyEffect: function(effect) {
        if (effect.gold) this.state.gold += effect.gold;
        if (effect.hp) this.state.hp += effect.hp;
        if (effect.setFlag) this.state.flags[effect.setFlag] = true;
        if (effect.addLore) {
            // Добавляем запись в журнал
            this.state.lore.push(effect.addLore);
            this.ui.showToast("Новая запись в журнале!");
        }
        this.ui.updateStats();
    },

    checkRequirement: function(req) {
        if (req.gold && this.state.gold < req.gold) return false;
        return true;
    },

    resetProgress: function() {
        if(confirm("Точно удалить весь прогресс?")) {
            location.reload(); // Пока просто перезагрузка
        }
    },

    // 5. UI Helpers
    ui: {
        // Тайпер текста
        typeText: function(elementId, text, speed, callback) {
            const element = document.getElementById(elementId);
            let i = 0;
            element.innerHTML = ""; // Чистим
            
            // Простой тайпер (не учитывает HTML теги внутри, для простоты пока только текст и <br>)
            // Если в тексте есть сложные теги, лучше использовать плавное появление (fade-in)
            // Но попробуем эмуляцию
            
            // Хак для <br>: заменим их на спецсимвол, а потом обратно
            // Или просто выводим посимвольно, если встречаем '<', ищем '>'
            
            let isTag = false;
            
            function type() {
                if (i < text.length) {
                    let char = text.charAt(i);
                    
                    if (char === '<') isTag = true;
                    
                    element.innerHTML += char;
                    
                    if (char === '>') isTag = false;

                    i++;
                    
                    if (isTag) {
                        type(); // Теги печатаем мгновенно
                    } else {
                        setTimeout(type, speed);
                    }
                } else {
                    if (callback) callback();
                }
            }
            type();
        },

        playIntroSequence: function(lines, callback) {
            const container = document.getElementById('intro-text-container');
            let delay = 0;
            lines.forEach(line => {
                const div = document.createElement('div');
                div.className = 'intro-line';
                div.innerText = line;
                container.appendChild(div);
                setTimeout(() => div.classList.add('visible'), delay);
                delay += 2000;
            });
            setTimeout(() => {
                const btn = document.getElementById('start-btn');
                btn.classList.remove('hidden');
                btn.onclick = callback;
            }, delay + 500);
        },

        updateStats: function() {
            document.getElementById('stat-gold').innerText = Game.state.gold;
            document.getElementById('stat-hp').innerText = Game.state.hp;
            document.getElementById('stat-cold').innerText = Game.state.cold + "%";
        },

        // Управление модальными окнами
        toggleModal: function(modalId) {
            const overlay = document.getElementById('modal-overlay');
            const modals = document.querySelectorAll('.modal-window');
            
            // Скрыть все окна
            modals.forEach(m => m.style.display = 'none');
            
            // Показать нужное
            const target = document.getElementById(`modal-${modalId}`);
            if(target) {
                target.style.display = 'block';
                target.classList.add('active');
                overlay.classList.remove('hidden');
                
                // Обновление контента при открытии
                if(modalId === 'skills') Game.ui.renderSkills();
                if(modalId === 'inventory') Game.ui.renderInventory();
                if(modalId === 'journal') Game.ui.renderLore();
            }
        },

        closeModals: function() {
            document.getElementById('modal-overlay').classList.add('hidden');
        },
        
        renderSkills: function() {
            const list = document.getElementById('skills-list');
            list.innerHTML = "";
            for (let [skill, val] of Object.entries(Game.state.skills)) {
                list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span>${skill.toUpperCase()}</span> <span>${val}</span>
                </div>`;
            }
        },

        renderInventory: function() {
            const list = document.getElementById('inventory-list');
            if(Game.state.inventory.length === 0) {
                list.innerHTML = "Пусто";
                return;
            }
            list.innerHTML = Game.state.inventory.map(item => `<li>${item}</li>`).join('');
        },

        renderLore: function() {
            const div = document.getElementById('journal-content');
            if(Game.state.lore.length === 0) {
                div.innerHTML = "Вы пока ничего не узнали о мире.";
                return;
            }
            div.innerHTML = Game.state.lore.map(entry => `<div style="margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:5px;">${entry}</div>`).join('');
        },
        
        showToast: function(msg) {
            // Можно добавить всплывающее уведомление, пока просто лог
            console.log("Toast:", msg);
        }
    }
};

window.onload = () => Game.init();
