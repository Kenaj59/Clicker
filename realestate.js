class RealEstate {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.inventory = [];
        this.market = [];
        this.isUnlocked = false;

        // Czas trwania procesów (ms)
        this.BUY_DURATION = 5 * 60 * 1000;      // 5 min na formalności zakupu
        this.RENOVATION_DURATION = 8 * 60 * 1000; // 8 min na remont

        this.locations = ["Centrum", "Przedmieścia", "Dzielnica Biznesowa", "Stare Miasto"];
    }

    updateTick() {
        if (!this.isUnlocked) return;
        const now = Date.now();
        let needRender = false;

        for (let i = this.inventory.length - 1; i >= 0; i--) {
            const apt = this.inventory[i];

            // 1. Koniec kupowania (formalności)
            if (apt.buyEndTime > 0 && now >= apt.buyEndTime) {
                apt.buyEndTime = 0;
                // Losowanie zadłużenia (40% szans na dług)
                if (Math.random() < 0.4) {
                    apt.debt = Math.floor(apt.totalValue * (Math.random() * 0.25));
                }
                this.game.notify(`Mieszkanie ${apt.name} jest gotowe!`, "success");
                needRender = true;
            }

            // 2. Koniec remontu
            if (apt.renovationEndTime > 0 && now >= apt.renovationEndTime) {
                apt.renovationEndTime = 0;
                apt.modernity = Math.min(10, apt.modernity + 3);
                apt.amenities = Math.min(10, apt.amenities + 2);
                this.game.notify(`Remont zakończony: ${apt.name}`, "success");
                needRender = true;
            }

            // 3. Koniec sprzedaży (szukanie klienta)
            if (apt.sellEndTime > 0 && now >= apt.sellEndTime) {
                const finalPrice = apt.area * apt.setPricePerM2;
                this.game.balance += finalPrice;
                const profit = finalPrice - apt.totalValue - (apt.paidDebt || 0);
                
                this.inventory.splice(i, 1);
                this.game.playSound('buy');
                this.game.notify(`Sprzedano nieruchomość! Zysk: $${this.game.formatNumber(profit)}`, "gold");
                needRender = true;
            }
        }

        if (document.getElementById('realestate-modal').style.display === 'flex') {
            this.render();
        }
    }

    generateMarket() {
        this.market = [];
        for (let i = 0; i < 3; i++) {
            const area = Math.floor(Math.random() * 80) + 30; // 30-110 m2
            const pricePerM2 = Math.floor(Math.random() * 5000) + 4000;
            const distance = Math.floor(Math.random() * 10) + 1; // 1 = centrum
            
            this.market.push({
                id: Date.now() + i,
                name: `Apartament ${this.locations[Math.floor(Math.random() * this.locations.length)]}`,
                area: area,
                basePricePerM2: pricePerM2,
                totalValue: area * pricePerM2,
                distance: distance,
                modernity: Math.floor(Math.random() * 10) + 1,
                amenities: Math.floor(Math.random() * 10) + 1,
                debt: 0,
                buyEndTime: 0,
                renovationEndTime: 0,
                sellEndTime: 0
            });
        }
        this.render();
    }

    buyApartment(index) {
        const apt = this.market[index];
        if (this.game.balance >= apt.totalValue) {
            this.game.balance -= apt.totalValue;
            apt.buyEndTime = Date.now() + this.BUY_DURATION;
            this.inventory.push(apt);
            this.market.splice(index, 1);
            this.game.updateUI();
            this.render();
        } else {
            this.game.notify("Brak środków na zakup!", "error");
        }
    }

    payDebt(index) {
        const apt = this.inventory[index];
        if (this.game.balance >= apt.debt) {
            this.game.balance -= apt.debt;
            apt.paidDebt = (apt.paidDebt || 0) + apt.debt;
            apt.debt = 0;
            this.game.updateUI();
            this.render();
        }
    }

    renovate(index) {
        const apt = this.inventory[index];
        const cost = Math.floor(apt.totalValue * 0.15);
        if (this.game.balance >= cost && apt.buyEndTime === 0 && apt.debt === 0) {
            this.game.balance -= cost;
            apt.renovationEndTime = Date.now() + this.RENOVATION_DURATION;
            this.game.updateUI();
            this.render();
        }
    }

    sell(index, newPricePerM2) {
        const apt = this.inventory[index];
        apt.setPricePerM2 = parseFloat(newPricePerM2);
        
        // Logika czasu: im drożej, tym dłużej (wykładniczo)
        const ratio = apt.setPricePerM2 / apt.basePricePriceM2;
        const baseWait = 2 * 60 * 1000; // Min 2 minuty
        const waitTime = baseWait * Math.pow(ratio, 3); 

        apt.sellEndTime = Date.now() + waitTime;
        this.render();
    }

    open() {
        document.getElementById('realestate-modal').style.display = 'flex';
        if (this.market.length === 0) this.generateMarket();
        this.render();
    }

    close() { document.getElementById('realestate-modal').style.display = 'none'; }

    render() {
        const now = Date.now();
        const marketList = document.getElementById('re-market-list');
        marketList.innerHTML = '';
        this.market.forEach((apt, idx) => {
            marketList.innerHTML += `
                <div class="car-card" style="border-left-color: #009688">
                    <strong>${apt.name} - ${apt.area}m²</strong><br>
                    <small>Dystans: ${apt.distance}/10 | Nowoczesność: ${apt.modernity}/10</small><br>
                    <strong>Cena: $${this.game.formatNumber(apt.totalValue)}</strong><br>
                    <button class="btn-action btn-blue" onclick="game.realEstate.buyApartment(${idx})">Kup nieruchomość</button>
                </div>`;
        });

        const invList = document.getElementById('re-inventory-list');
        invList.innerHTML = '';
        this.inventory.forEach((apt, idx) => {
            const isBuying = apt.buyEndTime > 0;
            const isRenovating = apt.renovationEndTime > 0;
            const isSelling = apt.sellEndTime > 0;
            
            let actionHTML = "";
            if (isBuying) actionHTML = `<span>⏳ Proces zakupu: ${this.game.dealer.formatTimer(apt.buyEndTime - now)}</span>`;
            else if (apt.debt > 0) actionHTML = `<button class="btn-action btn-red" onclick="game.realEstate.payDebt(${idx})">Spłać dług: $${this.game.formatNumber(apt.debt)}</button>`;
            else if (isRenovating) actionHTML = `<span>🛠 Remont: ${this.game.dealer.formatTimer(apt.renovationEndTime - now)}</span>`;
            else if (isSelling) actionHTML = `<span>📢 Sprzedaż: ${this.game.dealer.formatTimer(apt.sellEndTime - now)}</span>`;
            else {
                actionHTML = `
                    <button class="btn-action btn-purple" onclick="game.realEstate.renovate(${idx})">Remont ($${this.game.formatNumber(apt.totalValue*0.15)})</button>
                    <div style="margin-top:10px">
                        <input type="number" id="price-input-${idx}" value="${apt.basePricePerM2 * 1.2}" style="width:80px">
                        <button class="btn-action btn-green" onclick="game.realEstate.sell(${idx}, document.getElementById('price-input-${idx}').value)">Wystaw</button>
                    </div>`;
            }

            invList.innerHTML += `
                <div class="car-card" style="border-left-color: ${isSelling ? '#FF9800' : '#4CAF50'}">
                    <strong>${apt.name}</strong><br>
                    ${actionHTML}
                </div>`;
        });
    }
}