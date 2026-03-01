// --- KLASA DEALERA (ZAKTUALIZOWANA O CZAS SPRZEDAŻY) ---
class CarDealer {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.inventory = [];
        this.market = [];
        this.isUnlocked = false;
        
        // Zmienne czasowe
        this.marketEndTime = 0;
        this.marketCost = 2000;
        
        // KONFIGURACJA CZASÓW (ms)
        this.MARKET_DURATION = 15 * 60 * 1000; // 15 min na dostawę
        this.REPAIR_DURATION = 10 * 60 * 1000; // 10 min na naprawę
        
        // Sprzedaż: od 20 sekund do 2 minut
        this.SELL_MIN_TIME = 20 * 1000; 
        this.SELL_MAX_TIME = 120 * 1000;

        this.carNames = ["Fiat 126p", "Golf III", "Civic V", "Passat B5", "Audi A4", "BMW E46", "Mustang GT", "Porsche 911", "Lambo"];
    }

    updateTick() {
        if (!this.isUnlocked) return;
        const now = Date.now();
        let needRender = false;

        // 1. Obsługa Dostaw (Rynek)
        if (this.marketEndTime > 0) {
            if (now >= this.marketEndTime) {
                this.marketEndTime = 0;
                this.generateMarket();
                this.game.notify("Dostawa aut dotarła!", "gold");
                this.game.playSound('win');
            }
            needRender = true;
        }

        // 2. Obsługa Garażu (Naprawy i Sprzedaż)
        // Używamy pętli for-reverse, żeby móc bezpiecznie usuwać sprzedane auta
        for (let i = this.inventory.length - 1; i >= 0; i--) {
            const car = this.inventory[i];

            // A) Koniec Naprawy
            if (car.repairEndTime > 0 && now >= car.repairEndTime) {
                car.repairEndTime = 0;
                const fix = Math.floor(Math.random() * 21) + 10; // +10-30%
                car.condition = Math.min(100, car.condition + fix);
                this.game.notify(`Naprawiono: ${car.name}`, "success");
                needRender = true;
            }

            // B) Koniec Sprzedaży (Klient kupił)
            if (car.sellEndTime > 0 && now >= car.sellEndTime) {
                // Finalizacja transakcji
                const val = Math.floor(car.baseValue * (car.condition / 100) * 1.1); // 10% marży
                this.game.balance += val;
                
                // Usuwamy auto z tablicy
                this.inventory.splice(i, 1);
                
                this.game.playSound('buy');
                const profit = val - car.price;
                
                // Komunikat
                const type = profit > 0 ? "success" : "error";
                this.game.notify(`Sprzedano ${car.name}! Zysk: $${this.game.formatNumber(profit)}`, type);
                
                needRender = true;
            }
        }

        if (document.getElementById('dealer-modal').style.display === 'flex') {
            this.render();
        }
    }

    // --- AKCJE ---

    orderMarketRefresh() {
        if (this.marketEndTime > 0) return;
        if (this.game.balance >= this.marketCost) {
            this.game.balance -= this.marketCost;
            this.market = [];
            this.marketEndTime = Date.now() + this.MARKET_DURATION;
            this.game.playSound('buy');
            this.game.notify("Zamówiono transport (15 min)", "success");
            this.game.updateUI();
            this.render();
        } else {
            this.game.notify(`Brak środków ($${this.game.formatNumber(this.marketCost)})`, "error");
        }
    }

    generateMarket() {
        this.market = [];
        for(let i=0; i<5; i++) {
            const name = this.carNames[Math.floor(Math.random() * this.carNames.length)];
            const baseVal = (this.carNames.indexOf(name) + 1) * 2000;
            const cond = Math.floor(Math.random() * 50) + 40;
            const price = Math.floor(baseVal * (cond / 100) * 0.9);
            
            this.market.push({
                id: Date.now() + i,
                name: name,
                baseValue: baseVal,
                condition: cond,
                price: price,
                repairEndTime: 0,
                sellEndTime: 0 // Nowe pole: czas sprzedaży
            });
        }
        this.render();
    }

    buyCar(index) {
        const car = this.market[index];
        if (this.game.balance >= car.price) {
            this.game.balance -= car.price;
            const surprise = Math.floor(Math.random() * 21) - 15;
            car.condition = Math.max(0, Math.min(100, car.condition + surprise));
            
            this.inventory.push(car);
            this.market.splice(index, 1);
            
            this.game.playSound('buy');
            this.game.notify(`Kupiono ${car.name}`, "success");
            this.game.updateUI();
            this.render();
        } else {
            this.game.notify("Za mało środków!", "error");
        }
    }

    repairCar(index) {
        const car = this.inventory[index];
        if (car.repairEndTime > 0 || car.sellEndTime > 0) return; // Blokada
        
        const cost = 500 + Math.floor(car.baseValue * 0.1);
        if (this.game.balance >= cost) {
            this.game.balance -= cost;
            car.repairEndTime = Date.now() + this.REPAIR_DURATION;
            
            this.game.playSound('buy');
            this.game.notify("Naprawa rozpoczęta (10 min)", "success");
            this.game.updateUI();
            this.render();
        } else {
            this.game.notify("Brak środków na naprawę", "error");
        }
    }

    // Nowa metoda: Wystaw na sprzedaż
    sellCar(index) {
        const car = this.inventory[index];
        
        // Zabezpieczenia
        if (car.repairEndTime > 0) { this.game.notify("Auto jest w serwisie!", "error"); return; }
        if (car.sellEndTime > 0) { this.game.notify("Już wystawiono na sprzedaż!", "error"); return; }
        
        // Losowy czas oczekiwania na klienta
        const waitTime = Math.floor(Math.random() * (this.SELL_MAX_TIME - this.SELL_MIN_TIME + 1)) + this.SELL_MIN_TIME;
        
        car.sellEndTime = Date.now() + waitTime;
        
        this.game.notify(`Wystawiono ogłoszenie (ok. ${Math.ceil(waitTime/1000)}s)`, "gold");
        this.render();
    }

    // --- RENDEROWANIE ---

    formatTimer(ms) {
        if(ms < 0) return "0:00";
        const totalSec = Math.ceil(ms / 1000); // ceil wygląda lepiej przy odliczaniu
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    open() { if(this.isUnlocked) { document.getElementById('dealer-modal').style.display = 'flex'; this.render(); } }
    close() { document.getElementById('dealer-modal').style.display = 'none'; }

    render() {
        const now = Date.now();
        const marketList = document.getElementById('dealer-market-list');
        const marketHeader = document.getElementById('dealer-market-header');

        // Header Rynku
        if (this.marketEndTime > 0) {
            marketHeader.innerHTML = `<button class="btn-action" disabled style="width:100%; background:#444; margin-bottom:10px;">Dostawa: ${this.formatTimer(this.marketEndTime - now)}</button>`;
        } else {
            marketHeader.innerHTML = `<button class="btn-action btn-purple" onclick="game.dealer.orderMarketRefresh()" style="width:100%; margin-bottom:10px;">Zamów Transport ($${this.game.formatNumber(this.marketCost)})</button>`;
        }

        // Lista Rynku
        marketList.innerHTML = '';
        if (this.market.length === 0 && this.marketEndTime === 0) {
            marketList.innerHTML = '<p style="text-align:center; color:#666;">Plac pusty.</p>';
        } else {
            this.market.forEach((car, idx) => {
                const div = document.createElement('div');
                div.className = 'car-card';
                div.innerHTML = `
                    <div class="car-info"><strong>${car.name}</strong><br><span style="color:#aaa">Stan: ${car.condition}%</span></div>
                    <button class="btn-action btn-blue" onclick="game.dealer.buyCar(${idx})">Kup $${this.game.formatNumber(car.price)}</button>
                `;
                marketList.appendChild(div);
            });
        }

        // Garaż
        const garageList = document.getElementById('dealer-garage-list');
        garageList.innerHTML = '';
        if (this.inventory.length === 0) garageList.innerHTML = '<p style="text-align:center; color:#666;">Pusty garaż</p>';
        
        this.inventory.forEach((car, idx) => {
            const isRepairing = car.repairEndTime > 0;
            const isSelling = car.sellEndTime > 0;
            const busy = isRepairing || isSelling;
            
            let statusHTML = '';
            if (isRepairing) statusHTML = `<br><span style="color:#FF9800">⏳ Naprawa: ${this.formatTimer(car.repairEndTime - now)}</span>`;
            if (isSelling) statusHTML = `<br><span style="color:#2196F3">💲 Szukanie kupca: ${this.formatTimer(car.sellEndTime - now)}</span>`;

            const condColor = car.condition > 80 ? '#4CAF50' : (car.condition < 40 ? '#d32f2f' : '#FF9800');
            const sellVal = Math.floor(car.baseValue * (car.condition / 100) * 1.1);
            const repairCost = 500 + Math.floor(car.baseValue * 0.1);

            const div = document.createElement('div');
            div.className = 'car-card';
            div.style.borderLeft = `5px solid ${isSelling ? '#2196F3' : condColor}`; // Niebieski pasek jak sprzedajemy
            
            div.innerHTML = `
                <div class="car-info">
                    <strong>${car.name}</strong> <span style="font-size:0.8em; color:${condColor}">(${car.condition}%)</span>
                    ${statusHTML}
                    ${!busy ? `<br><span style="color:#aaa; font-size:0.8em">Wartość: $${this.game.formatNumber(sellVal)}</span>` : ''}
                </div>
                <div class="car-actions">
                    ${!busy ? `
                        <button class="btn-action" style="background:#9c27b0" onclick="game.dealer.repairCar(${idx})">Napraw ($${repairCost})</button>
                        <button class="btn-action" style="background:#388E3C" onclick="game.dealer.sellCar(${idx})">Sprzedaj</button>
                    ` : `
                        <button class="btn-action" disabled style="background:#444; width:100%">${isSelling ? 'Czekanie na klienta...' : 'Serwis...'}</button>
                    `}
                </div>
            `;
            garageList.appendChild(div);
        });
    }
}