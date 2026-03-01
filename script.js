class Game {
    constructor() {
        this.balance = 0;
        this.clickValue = 1;
        this.clickUpgradeCost = 50;
        this.passiveIncome = 0;

        // --- TWORZYMY DEALERA ---
        this.dealer = new CarDealer(this);

        this.businesses = [
            { id: 0, name: 'Stoisko z Lemoniadą', cost: 15, income: 1, count: 0 },
            { id: 1, name: 'Roznoszenie Gazet', cost: 100, income: 5, count: 0 },
            { id: 2, name: 'Myjnia Samochodowa', cost: 1100, income: 45, count: 0 },
            { id: 3, name: 'Sieć Pizzerii', cost: 12000, income: 260, count: 0 },
            // ID 4 to Dealer
            { id: 4, name: 'Koncesja Dealera', cost: 50000, income: 0, count: 0, type: 'special' }
        ];

        this.stocks = [
            { id: 0, symbol: 'TECH', name: 'NanoTech', price: 100, owned: 0, volatility: 0.15, history: [], chart: null, color: '#2196F3' },
            { id: 1, symbol: 'FOOD', name: 'Burger King', price: 50, owned: 0, volatility: 0.05, history: [], chart: null, color: '#FF9800' },
            { id: 2, symbol: 'GOLD', name: 'Kopalnia Złota', price: 500, owned: 0, volatility: 0.25, history: [], chart: null, color: '#FFD700' }
        ];

        this.achievements = [
            { id: 'first_cash', name: 'Pierwsza Kasa', desc: 'Zdobądź $50', unlocked: false, condition: () => this.balance >= 50 },
            { id: 'investor', name: 'Inwestor', desc: 'Kup 10 biznesów', unlocked: false, condition: () => this.getTotalBizCount() >= 10 },
            { id: 'dealer_unlock', name: 'Handlarz', desc: 'Otwórz Salon', unlocked: false, condition: () => this.dealer.isUnlocked }
        ];

        try { this.loadGame(); } catch(e) { console.error("Save error", e); }
        this.init();
    }

    init() {
        this.recalcIncome();

        // GŁÓWNA PĘTLA (1 sekunda)
        setInterval(() => {
            this.balance += this.passiveIncome;
            this.checkAchievements();
            this.updateUI();
            
            // AKTUALIZACJA DEALERA (CZAS)
            this.dealer.updateTick();

        }, 1000);

        setInterval(() => this.updateMarket(), 60000);
        setInterval(() => this.saveGame(), 30000);

        this.renderAll();
        setTimeout(() => { try { this.initStocksDOM(); } catch(e) { this.renderStockListSimple(); } }, 100);
    }

    // --- (Standardowe metody bez zmian: manualClick, buyClickUpgrade...) ---
    
    manualClick() { this.balance += this.clickValue; this.checkAchievements(); this.updateUI(); const btn = document.getElementById('click-btn'); if(btn) { btn.style.transform = "scale(0.95)"; setTimeout(() => btn.style.transform = "scale(1)", 50); } }
    
    buyClickUpgrade() { if(this.balance >= this.clickUpgradeCost) { this.balance -= this.clickUpgradeCost; this.clickValue++; this.clickUpgradeCost = Math.ceil(this.clickUpgradeCost * 1.6); this.playSound('buy'); this.notify("Ulepszono klikanie!", "success"); this.updateUI(); } }

    buyBusiness(id) {
        const biz = this.businesses[id];
        if (biz.type === 'special' && biz.count > 0) return;
        
        if (this.balance >= biz.cost) {
            this.balance -= biz.cost;
            biz.count++;
            
            if (biz.type !== 'special') biz.cost = Math.ceil(biz.cost * 1.15);
            
            // Odblokowanie dealera
            if (biz.id === 4) {
                this.dealer.isUnlocked = true;
                document.getElementById('btn-open-dealer').style.display = 'block';
                this.notify("SALON OTWARTY!", "gold");
                this.playSound('win');
            } else {
                this.playSound('buy');
                this.notify(`Kupiono: ${biz.name}`, "success");
            }

            this.recalcIncome();
            this.renderBusiness();
            this.updateUI();
        }
    }

    // --- (GIEŁDA - SKRÓCONA, BEZ ZMIAN) ---
    initStocksDOM() {
        if (typeof Chart === 'undefined') throw new Error("Chart.js missing");
        const list = document.getElementById('stock-list'); list.innerHTML = '';
        this.stocks.forEach(stock => {
            if(stock.history.length === 0) { let p = stock.price; for(let i=0; i<20; i++) stock.history.push(p); }
            const card = document.createElement('div'); card.className = 'stock-card';
            card.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${stock.symbol}</strong><strong id="price-${stock.id}">$${this.formatNumber(stock.price)}</strong></div><div class="stock-chart-container"><canvas id="chart-${stock.id}"></canvas></div><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;"><span id="owned-${stock.id}" style="color:#aaa;">Masz: ${stock.owned}</span></div><div class="stock-actions"><button class="btn-action btn-red" onclick="game.sellStock(${stock.id}, 1)">-1</button><button class="btn-action btn-red" onclick="game.sellAllStock(${stock.id})">All</button><div style="width:10px;"></div><button class="btn-action btn-blue" onclick="game.buyStock(${stock.id}, 1)">+1</button><button class="btn-action btn-blue" onclick="game.buyStock(${stock.id}, 10)">+10</button><button class="btn-action btn-purple" onclick="game.buyMaxStock(${stock.id})">MAX</button></div>`;
            list.appendChild(card);
            const ctx = document.getElementById(`chart-${stock.id}`).getContext('2d');
            stock.chart = new Chart(ctx, { type: 'line', data: { labels: Array(20).fill(''), datasets: [{ data: stock.history, borderColor: stock.color, borderWidth: 2, pointRadius: 0, fill: false, tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: true, grid: { color: '#444' } } }, animation: { duration: 0 } } });
        });
    }
    renderStockListSimple() {}
    updateMarket() {
        this.stocks.forEach(stock => {
            const change = (Math.random() * stock.volatility * 2) - stock.volatility; stock.price = stock.price * (1 + change); if(stock.price < 1) stock.price = 1; stock.history.push(stock.price); if(stock.history.length > 20) stock.history.shift();
            const priceEl = document.getElementById(`price-${stock.id}`); if(priceEl) { priceEl.innerText = `$${this.formatNumber(stock.price)}`; priceEl.style.color = change >= 0 ? '#4CAF50' : '#d32f2f'; }
            if(stock.chart) { stock.chart.data.datasets[0].data = stock.history; stock.chart.update(); }
        });
        this.notify("Giełda: Zaktualizowano ceny!", "success");
    }
    buyStock(id, amount) { const stock = this.stocks[id]; const totalCost = stock.price * amount; if(this.balance >= totalCost) { this.balance -= totalCost; stock.owned += amount; this.playSound('buy'); this.notify(`Kupiono ${amount}x ${stock.symbol}`, "success"); this.updateUI(); this.checkAchievements(); } else { this.notify("Za mało środków!", "error"); } }
    buyMaxStock(id) { const stock = this.stocks[id]; const max = Math.floor(this.balance / stock.price); if (max > 0) this.buyStock(id, max); else this.notify("Nie stać cię!", "error"); }
    sellStock(id, amount) { const stock = this.stocks[id]; if(stock.owned >= amount) { this.balance += stock.price * amount; stock.owned -= amount; this.playSound('buy'); this.notify(`Sprzedano ${amount}x ${stock.symbol}`, "success"); this.updateUI(); } else { this.notify("Brak akcji!", "error"); } }
    sellAllStock(id) { const s = this.stocks[id]; if(s.owned > 0) this.sellStock(id, s.owned); }

    // --- RENDERERY ---
    renderBusiness() {
        const list = document.getElementById('business-list'); if(!list) return; list.innerHTML = '';
        this.businesses.forEach(biz => {
            const div = document.createElement('div'); div.className = 'item-card biz-border';
            let btnText = `Kup $${this.formatNumber(biz.cost)}`; let ownedText = biz.count;
            if(biz.type === 'special') { if(biz.count > 0) { btnText = "POSIADANE"; ownedText = "✔"; } }
            div.innerHTML = `<div style="display:flex; align-items:center;"><div style="font-size:1.5em; font-weight:bold; width:40px; text-align:center; color:#666;">${ownedText}</div><div><h3 style="margin:0; font-size:1em">${biz.name}</h3><p style="margin:0; font-size:0.9em; color:#ccc;">${biz.income > 0 ? '+$'+this.formatNumber(biz.income)+'/sek' : 'Biznes Specjalny'}</p></div></div><button id="btn-biz-${biz.id}" class="btn-action btn-blue" onclick="game.buyBusiness(${biz.id})">${btnText}</button>`;
            list.appendChild(div);
        });
        this.updateButtonsState();
    }
    updateUI() {
        const balEl = document.getElementById('balance'); if(balEl) balEl.innerText = this.formatNumber(this.balance);
        const incEl = document.getElementById('income'); if(incEl) incEl.innerText = this.formatNumber(this.passiveIncome);
        const upgBtn = document.getElementById('btn-upgrade-click'); if(upgBtn) { upgBtn.innerHTML = `Szkolenie ($${this.formatNumber(this.clickUpgradeCost)})`; upgBtn.disabled = this.balance < this.clickUpgradeCost; }
        this.stocks.forEach(stock => { const el = document.getElementById(`owned-${stock.id}`); if(el) el.innerText = `Masz: ${stock.owned}`; });
        this.updateButtonsState();
    }
    updateButtonsState() {
        this.businesses.forEach(biz => {
            const btn = document.getElementById(`btn-biz-${biz.id}`);
            if(btn) {
                if(biz.type === 'special' && biz.count > 0) { btn.disabled = true; btn.style.background = "#4CAF50"; return; }
                btn.disabled = this.balance < biz.cost;
                if(btn.disabled) { btn.style.backgroundColor = "#555"; btn.style.cursor = "not-allowed"; } else { btn.style.backgroundColor = "#2196F3"; btn.style.cursor = "pointer"; }
            }
        });
    }
    renderAchievements() {
        const list = document.getElementById('achievement-list'); if(!list) return; list.innerHTML = '';
        this.achievements.forEach(ach => {
            const div = document.createElement('div'); div.className = `item-card ach-border ${ach.unlocked ? 'unlocked' : ''}`;
            div.innerHTML = `<div style="font-size:2em; margin-right:15px;">${ach.unlocked ? '🏆' : '🔒'}</div><div><div style="font-weight:bold; color:${ach.unlocked ? '#ffd700' : '#888'}">${ach.name}</div><div style="font-size:0.8em; color:#ccc;">${ach.desc}</div></div>`;
            list.appendChild(div);
        });
    }
    renderAll() { this.renderBusiness(); this.renderAchievements(); this.updateUI(); }
    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-content')); document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active-content'); const tabs = document.querySelectorAll('.tab-btn');
        if(tabName === 'business') tabs[0].classList.add('active'); if(tabName === 'invest') tabs[1].classList.add('active'); if(tabName === 'achievements') tabs[2].classList.add('active');
    }
    checkAchievements() { let changed = false; this.achievements.forEach(ach => { if (!ach.unlocked && ach.condition()) { ach.unlocked = true; changed = true; this.playSound('win'); this.notify(`OSIĄGNIĘCIE: ${ach.name}`, "gold"); } }); if (changed) { this.renderAchievements(); this.saveGame(); } }
    getTotalBizCount() { return this.businesses.reduce((sum, b) => sum + b.count, 0); }
    recalcIncome() { this.passiveIncome = this.businesses.reduce((sum, b) => sum + (b.income * b.count), 0); }
    formatNumber(num) { return num.toLocaleString('pl-PL', { maximumFractionDigits: 2, minimumFractionDigits: 2 }); }
    notify(message, type = 'success') { const area = document.getElementById('notification-area'); if(!area) return; const notif = document.createElement('div'); let icon = '✅'; let cssClass = 'notify-success'; if (type === 'gold') { icon = '🏆'; cssClass = 'notify-gold'; } if (type === 'error') { icon = '❌'; cssClass = 'notify-error'; } notif.className = `notification ${cssClass}`; notif.innerHTML = `<span class="notify-icon">${icon}</span> <span>${message}</span>`; area.appendChild(notif); setTimeout(() => notif.remove(), 3500); }
    playSound(soundName) { try { const audio = new Audio(`${soundName}.mp3`); audio.volume = 0.5; audio.play().catch(() => {}); } catch(e) {} }

    // --- SAVE SYSTEM ---
    saveGame() {
        const data = {
            balance: this.balance, clickValue: this.clickValue, clickUpgradeCost: this.clickUpgradeCost,
            businesses: this.businesses, stocks: this.stocks.map(s => ({ id: s.id, owned: s.owned, price: s.price, history: s.history })),
            achievements: this.achievements.map(a => ({ id: a.id, unlocked: a.unlocked })),
            dealer: { 
                isUnlocked: this.dealer.isUnlocked, 
                inventory: this.dealer.inventory,
                marketEndTime: this.dealer.marketEndTime,
                market: this.dealer.market 
            }
        };
        localStorage.setItem('financeGame_DealerFix', JSON.stringify(data));
        const msg = document.getElementById('save-msg');
        if(msg) { msg.innerText = "Zapisano!"; setTimeout(() => msg.innerText = "", 2000); }
    }

    loadGame() {
        const json = localStorage.getItem('financeGame_DealerFix');
        if(json) {
            const data = JSON.parse(json);
            this.balance = data.balance || 0; this.clickValue = data.clickValue || 1; this.clickUpgradeCost = data.clickUpgradeCost || 50;
            if(data.businesses) this.businesses = data.businesses;
            if(data.stocks) { data.stocks.forEach(saved => { const real = this.stocks.find(s => s.id === saved.id); if(real) { real.owned = saved.owned; real.price = saved.price; real.history = saved.history || []; } }); }
            if(data.achievements) { data.achievements.forEach(saved => { const real = this.achievements.find(a => a.id === saved.id); if(real) real.unlocked = saved.unlocked; }); }
            if(data.dealer) {
                this.dealer.isUnlocked = data.dealer.isUnlocked;
                this.dealer.inventory = data.dealer.inventory || [];
                this.dealer.marketEndTime = data.dealer.marketEndTime || 0;
                this.dealer.market = data.dealer.market || [];
                if(this.dealer.isUnlocked) document.getElementById('btn-open-dealer').style.display = 'block';
            }
        }
    }

    hardReset() {
        if(confirm("Czy na pewno chcesz usunąć zapis?")) {
            localStorage.removeItem('financeGame_DealerFix');
            location.reload();
        }
    }
}

// --- NARZĘDZIA DEWELOPERSKIE (DEV TOOLS) ---
document.addEventListener('keydown', (event) => {
    
    // SHIFT + D = Kasa
    if (event.shiftKey && (event.key === 'D' || event.key === 'd')) {
        game.balance += 100000; 
        game.updateUI(); 
        game.playSound('win'); 
        game.notify("DEV: +$100k", "gold");
    }

    // SHIFT + T = Przewiń Czas (Dostawy, Naprawy, SPRZEDAŻ)
    if (event.shiftKey && (event.key === 'T' || event.key === 't')) {
        let actionTaken = false;
        const now = Date.now();

        // 1. Rynek
        if (game.dealer.marketEndTime > 0) {
            game.dealer.marketEndTime = now - 1000;
            actionTaken = true;
        }

        // 2. Garaż (Naprawy i Sprzedaż)
        game.dealer.inventory.forEach(car => {
            if (car.repairEndTime > 0) {
                car.repairEndTime = now - 1000;
                actionTaken = true;
            }
            if (car.sellEndTime > 0) {
                car.sellEndTime = now - 1000;
                actionTaken = true;
            }
        });

        if (actionTaken) {
            game.dealer.updateTick(); // Wymuś sprawdzenie
            game.notify("DEV: Przewinięto czas!", "gold");
            game.playSound('win');
        } else {
            game.notify("DEV: Brak aktywnych liczników", "error");
        }
    }
});

const game = new Game();