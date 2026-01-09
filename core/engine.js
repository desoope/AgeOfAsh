const Game = {
    state: {
        hp: 100,
        gold: 10, // Дадим немного золота на старте
        cold: 0,
        inventory: ["Старый плащ"],
        // Переведенные навыки
        skills: {
            "Сила": 1,
            "Ловкость": 1,
            "Красноречие": 1,
            "Скрытность": 1
        },
        flags: {}, 
        currentChapter: null,
        lore: [] 
    },

    init: function() {
        this.ui.playIntroSequence([
            "Мир трещит по швам...",
            "Огонь угасает...",
            "И только пепел помнит всё."
        ], () => {
            document.getElementById('intro-screen').classList.remove('active');
            document.getElementById('lore-screen').classList.add('active');
            
            const loreText = "За двести лет до твоего рождения Солнце начало остывать. Великие королевства пали, превратившись в замерзшие руины.<br><br>Ныне миром правят те, у кого есть огонь и сталь. Ты — бродяга, ищущий убежище в городе <b>Морхейм</b>.";
            
            this.ui.typeText('lore-text-typing', loreText, 20, () => {
                document.getElementById('to-game-btn').classList.remove('hidden-btn');
            });
        });

        document.getElementById('to-game-btn').onclick = () => {
            document.getElementById('lore-screen').classList.remove('active');
            document.getElementById('game-screen').classList.add('active');
            this.loadChapter("chapter_0_intro");
        };
    },

    loadChapter: async function(chapterFolder) {
        try {
            const response = await fetch(`content/${chapterFolder}/data.json`);
            this.currentChapterData = await response.json();
            this.state.currentChapter = chapterFolder;
            
            const styleLink = document.getElementById('chapter-style');
            if(styleLink) styleLink.href = `content/${chapterFolder}/style.css`; 
            
            this.renderScene(this.currentChapterData.startScene);
        } catch (e) {
            console.error(e);
            alert("Ошибка загрузки главы (проверь консоль)");
        }
    },

    renderScene: function(sceneId) {
        const scene = this.currentChapterData.scenes[sceneId];
        
        // Логические переходы (если сцена только для проверки условий)
        if (scene.type === "logic") {
            const nextScene = this.checkConditions(scene.next);
            this.renderScene(nextScene);
            return;
        }

        // История (Архивация старого текста)
        const textBlock = document.getElementById('typing-text');
        const oldText = textBlock.innerHTML;
        const historyLog = document.getElementById('history-log');
        
        if (oldText && oldText !== "") {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-block';
            historyItem.innerHTML = oldText;
            historyLog.appendChild(historyItem);
        }

        // Картинка
        const imgBlock = document.getElementById('scene-image');
        if (scene.image) {
            imgBlock.style.backgroundImage = `url('content/${this.state.currentChapter}/${scene.image}')`;
            imgBlock.classList.add('active');
        } else {
            imgBlock.classList.remove('active');
        }

        // Очистка перед печатью
        const choicesBox = document.getElementById('choices-box');
        choicesBox.innerHTML = ""; 
        textBlock.innerHTML = "";

        // Сборка текста
        let fullText = Array.isArray(scene.text) ? scene.text.join("<br><br>") : scene.text;

        // Запуск печати
        this.ui.typeText('typing-text', fullText, 15, () => {
            if (scene.choices) {
                scene.choices.forEach(choice => {
                    // Проверка условий отображения кнопки (req)
                    if (choice.req && !this.checkRequirement(choice.req)) return;

                    const btn = document.createElement('button');
                    btn.className = 'choice-btn';
                    btn.innerHTML = choice.text; // innerHTML чтобы работали жирные шрифты в кнопках
                    btn.onclick = () => this.makeChoice(choice);
                    choicesBox.appendChild(btn);
                });
            }
            // Скролл вниз
            const scrollArea = document.getElementById('story-scroll-area');
            scrollArea.scrollTop = scrollArea.scrollHeight;
        });
    },

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
        if (effect.cold) this.state.cold += effect.cold;
        if (effect.setFlag) this.state.flags[effect.setFlag] = true;
        
        // Прокачка навыков
        if (effect.skillUp) {
            const skillName = effect.skillUp;
            if (this.state.skills[skillName] !== undefined) {
                this.state.skills[skillName]++;
                this.ui.showToast(`Навык повышен: ${skillName}`);
            }
        }

        if (effect.addItem) {
            this.state.inventory.push(effect.addItem);
            this.ui.showToast(`Получено: ${effect.addItem}`);
        }
        
        if (effect.addLore) {
            this.state.lore.push(effect.addLore);
            this.ui.showToast("Новая запись в журнале!");
        }
        this.ui.updateStats();
    },

    checkRequirement: function(req) {
        if (req.gold && this.state.gold < req.gold) return false;
        if (req.skill) {
            // Пример req: { skill: "Сила", val: 2 }
            const [skillName, val] = Object.entries(req.skill)[0]; 
            // Упростим: req: { skillName: "Сила", val: 2 }
            if (this.state.skills[req.skillName] < req.val) return false;
        }
        if (req.flag && !this.state.flags[req.flag]) return false;
        if (req.noFlag && this.state.flags[req.noFlag]) return false; // Если флага НЕ должно быть
        return true;
    },

    // Логика проверки условий для переходов
    checkConditions: function(logicObj) {
        // Проверяем флаги
        for (let key in logicObj) {
            if (key === "default") continue;
            if (this.state.flags[key]) return logicObj[key];
        }
        return logicObj.default;
    },

    resetProgress: function() {
        if(confirm("Сбросить весь прогресс?")) location.reload();
    },

    ui: {
        // ИСПРАВЛЕННЫЙ ТАЙПЕР (Умеет пропускать HTML теги)
        typeText: function(elementId, text, speed, callback) {
            const element = document.getElementById(elementId);
            let i = 0;
            element.innerHTML = ""; 
            
            function type() {
                if (i < text.length) {
                    const char = text.charAt(i);
                    
                    // Если встречаем открывающую скобку тега
                    if (char === '<') {
                        let tag = "";
                        // Читаем весь тег целиком до закрывающей скобки
                        while (text.charAt(i) !== '>' && i < text.length) {
                            tag += text.charAt(i);
                            i++;
                        }
                        tag += '>'; // Добавляем закрывающую
                        i++; // Переходим к следующему символу после тега
                        element.innerHTML += tag; // Вставляем тег мгновенно
                        type(); // Сразу вызываем следующую итерацию без задержки
                    } else {
                        element.innerHTML += char;
                        i++;
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
                delay += 2500;
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

        toggleModal: function(modalId) {
            const overlay = document.getElementById('modal-overlay');
            const modals = document.querySelectorAll('.modal-window');
            modals.forEach(m => m.style.display = 'none');
            
            const target = document.getElementById(`modal-${modalId}`);
            if(target) {
                target.style.display = 'block';
                target.classList.add('active');
                overlay.classList.remove('hidden');
                
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
                list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">
                    <span>${skill}</span> <span style="color:#9d46ff">${val}</span>
                </div>`;
            }
        },

        renderInventory: function() {
            const list = document.getElementById('inventory-list');
            if(Game.state.inventory.length === 0) list.innerHTML = "Пусто";
            else list.innerHTML = Game.state.inventory.map(item => `<li style="margin-bottom:5px;">${item}</li>`).join('');
        },

        renderLore: function() {
            const div = document.getElementById('journal-content');
            if(Game.state.lore.length === 0) div.innerHTML = "Вы пока ничего не узнали о мире.";
            else div.innerHTML = Game.state.lore.map(entry => `<div style="margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">${entry}</div>`).join('');
        },
        
        showToast: function(msg) {
            console.log("Уведомление:", msg);
            // В будущем тут сделаем всплывашку на экране
        }
    }
};

window.onload = () => Game.init();
