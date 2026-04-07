// ============================================
// DigiDash - Main Application
// Orchestrates data loading, rendering, and UI
// ============================================

const App = {
    data: null,
    currentPage: 'overview',

    // URL slug ↔ internal page mapping
    slugToPage: {
        'tong-quan': 'overview',
        'fb-chuyen-doi': 'facebook',
        'fb-tin-nhan': 'fbmessage',
        'google-ads': 'google',
        'tiktok-ads': 'tiktok',
        'kpi': 'kpi',
        'content-plan': 'content',
        'tasks': 'tasks',
        'bao-cao': 'reports'
    },
    pageToSlug: {},  // built from slugToPage in init

    /**
     * Initialize the application
     */
    async init() {
        // Build reverse slug map
        for (const [slug, page] of Object.entries(this.slugToPage)) {
            this.pageToSlug[page] = slug;
        }

        ChartManager.init();
        this.setupNavigation();
        this.setupRouting();
        this.setupSettings();
        this.setupSearch();
        this.setupMobile();
        this.setupFbFilters();
        this.setupDragScroll();
        await this.loadData();

        // Navigate to page from URL hash (after data loaded)
        this.handleRoute();
    },

    // ============================================
    // DATA LOADING
    // ============================================

    async loadData() {
        this.showLoading(true);
        try {
            this.data = await DataService.loadAll();
            this.updateDataStatus(this.data.isDemo, this.data.liveSheets);
            this.renderCurrentPage();
        } catch (error) {
            console.error('Data load error:', error);
        }
        this.showLoading(false);
    },

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('show', show);
    },

    updateDataStatus(isDemo, liveSheets) {
        const el = document.getElementById('dataStatus');
        if (isDemo) {
            el.innerHTML = '<i class="fas fa-circle"></i><span>Demo Data</span>';
            el.classList.remove('live');
            el.classList.remove('partial');
        } else if (liveSheets && liveSheets.length < 6) {
            el.innerHTML = `<i class="fas fa-circle"></i><span>Live (${liveSheets.length}/6)</span>`;
            el.classList.add('live');
        } else {
            el.innerHTML = '<i class="fas fa-circle"></i><span>Live Data</span>';
            el.classList.add('live');
        }
    },

    // ============================================
    // NAVIGATION
    // ============================================

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    /**
     * Hash-based URL routing
     */
    setupRouting() {
        window.addEventListener('hashchange', () => this.handleRoute());
    },

    handleRoute() {
        const hash = window.location.hash.replace(/^#\/?/, ''); // Remove #/ prefix
        if (hash && this.slugToPage[hash]) {
            const page = this.slugToPage[hash];
            if (page !== this.currentPage) {
                this.navigateTo(page, false); // false = don't push hash again
            }
        } else if (!hash) {
            // No hash → default page
            this.navigateTo('overview', false);
        }
    },

    navigateTo(page, pushHash = true) {
        this.currentPage = page;

        // Update URL hash
        if (pushHash) {
            const slug = this.pageToSlug[page] || page;
            window.location.hash = '#/' + slug;
        }

        // Update nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navItem) navItem.classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add('active');

        // Update title
        const titles = {
            overview: 'Tổng quan Digital Marketing',
            facebook: 'FB Ads Chuyển đổi',
            fbmessage: 'FB Ads Tin nhắn',
            google: 'Google Ads Performance',
            tiktok: 'TikTok Ads Performance',
            kpi: 'KPIs Nhân sự',
            content: 'Content Plan',
            tasks: 'Task Management',
            reports: 'Lịch gửi báo cáo'
        };
        document.getElementById('pageTitle').textContent = titles[page] || '';

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');

        // Render page data
        this.renderCurrentPage();
    },

    renderCurrentPage() {
        if (!this.data) return;

        switch (this.currentPage) {
            case 'overview': this.renderOverview(); break;
            case 'facebook': this.renderFacebook(); break;
            case 'fbmessage': this.renderFbMessage(); break;
            case 'google': this.renderGoogle(); break;
            case 'tiktok': this.renderTiktok(); break;
            case 'kpi': this.renderKPI(); break;
            case 'content': this.renderContent(); break;
            case 'tasks': this.renderTasks(); break;
            case 'reports': this.renderReports(); break;
        }
    },

    // ============================================
    // OVERVIEW PAGE
    // ============================================

    renderOverview() {
        const allPerf = this.data.performance || [];
        const timeFiltered = this.filterByMonth(allPerf);
        const filtered = this.applyOvFilters(timeFiltered);

        // Cascading filters: each dropdown shows only values valid with other selections
        const ovFilters = [
            { id: 'ov-filter-company', field: 'maChienDich', label: 'Mã chiến dịch' },
            { id: 'ov-filter-channel', field: 'kenh', label: 'Kênh' },
            { id: 'ov-filter-type', field: 'loaiChienDich', label: 'Loại chiến dịch' },
        ];
        ovFilters.forEach(current => {
            // Filter data by all OTHER filters (not the current one)
            let contextData = timeFiltered;
            ovFilters.forEach(other => {
                if (other.id === current.id) return;
                const el = document.getElementById(other.id);
                if (el && el.value) contextData = contextData.filter(r => r[other.field] === el.value);
            });
            this.populateFilter(current.id, contextData, current.field, current.label);
        });

        // KPIs
        const sumN = (arr, f) => arr.reduce((s, r) => s + DataService.parseNumber(r[f]), 0);
        const avgN = (arr, f) => arr.length > 0 ? sumN(arr, f) / arr.length : 0;

        const totalSTT = sumN(filtered, 'stt');
        const totalNganSach = sumN(filtered, 'nganSachQCDuKien');
        const totalDonHangTB = sumN(filtered, 'donHangTBDuKien');
        const totalDonHangKV = sumN(filtered, 'soDonHangKyVong');
        const totalCPL = sumN(filtered, 'cplDuKien');
        const totalCPS = sumN(filtered, 'cpsDuKien');
        const totalLeads = sumN(filtered, 'soLeadCanDat');
        const totalTyLe = avgN(filtered, 'tyLeChuyenDoiDuKien');

        document.getElementById('ov-stt').textContent = this.formatNumber(totalSTT);
        document.getElementById('ov-ngan-sach').textContent = this.formatNumber(totalNganSach);
        document.getElementById('ov-doanh-so-ky-vong').textContent = this.formatNumber(totalDonHangTB);
        document.getElementById('ov-ngan-sach-2').textContent = this.formatNumber(totalNganSach);
        document.getElementById('ov-cpl').textContent = this.formatNumber(totalCPL);
        document.getElementById('ov-don-hang-ky-vong').textContent = this.formatCompact(totalDonHangKV);
        document.getElementById('ov-leads').textContent = this.formatCompact(totalLeads);
        document.getElementById('ov-cps').textContent = this.formatNumber(totalCPS);
        const tyLeEl = document.getElementById('ov-ty-le');
        if (tyLeEl) tyLeEl.textContent = totalTyLe.toFixed(1);
        this.drawGauge(totalTyLe);

        // Platform Cards
        this.renderPlatformCards(filtered);

        // Charts
        this.renderOvCharts(filtered);

        // Tables
        this.renderOvTables(filtered);
    },

    drawGauge(value) {
        const canvas = document.getElementById('ov-gauge');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2, cy = h - 5, r = Math.min(w, h) - 10;
        const startAngle = Math.PI;
        const endAngle = 2 * Math.PI;
        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#e0e0e0';
        ctx.stroke();
        // Value arc (0 to 100 scale)
        const pct = Math.min(Math.max(value, 0), 100) / 100;
        const valAngle = startAngle + pct * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, valAngle);
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#f9a825';
        ctx.lineCap = 'round';
        ctx.stroke();
    },

    applyOvFilters(data) {
        let result = data;
        [{ id: 'ov-filter-company', field: 'maChienDich' },
         { id: 'ov-filter-channel', field: 'kenh' }, { id: 'ov-filter-type', field: 'loaiChienDich' }].forEach(f => {
            const el = document.getElementById(f.id);
            if (el && el.value) result = result.filter(r => r[f.field] === el.value);
        });
        return result;
    },

    formatNumber(n) {
        if (n === 0) return '0';
        return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    },

    renderPlatformCards(data) {
        const container = document.getElementById('ov-platform-cards');
        const channels = [...new Set(data.map(r => r.kenh).filter(Boolean))];
        const iconMap = {
            'facebook': '<i class="fab fa-facebook" style="color:#1877f2"></i>',
            'tiktok': '<i class="fab fa-tiktok" style="color:#000"></i>',
            'google': '<i class="fab fa-google" style="color:#4285f4"></i>',
            'pr': '<i class="fas fa-newspaper" style="color:#22c55e"></i>',
            'seo': '<i class="fas fa-search" style="color:#f97316"></i>',
        };

        container.innerHTML = channels.map(ch => {
            const chData = data.filter(r => r.kenh === ch);
            const types = [...new Set(chData.map(r => r.loaiChienDich).filter(Boolean))];
            const months = [...new Set(chData.map(r => r.thang).filter(Boolean))].sort().reverse();
            const chKey = Object.keys(iconMap).find(k => ch.toLowerCase().includes(k));
            const icon = chKey ? iconMap[chKey] : '<i class="fas fa-bullhorn" style="color:#8b5cf6"></i>';
            const showMonths = months; // show ALL months
            const fields = [
                { label: 'STT', key: 'stt' },
                { label: 'Ngân sách quảng cáo dự kiến', key: 'nganSachQCDuKien' },
                { label: 'CPS dự kiến Chi phí/1 đơn hàng', key: 'cpsDuKien' },
                { label: 'CPL dự kiến Chi phí/1 lead', key: 'cplDuKien' },
                { label: 'Số đơn hàng kỳ vọng', key: 'soDonHangKyVong' },
                { label: 'Số lead cần đạt được', key: 'soLeadCanDat' },
                { label: 'Ngân sách quảng cáo thực tế', key: 'nganSachQCDuKien' },
            ];

            return `<div class="ov-platform-card">
                <div class="ov-platform-header">
                    ${icon}
                    <span class="ov-ph-label">Loại chiến dịch</span>
                    <span class="ov-ph-count">${types.length}</span>
                </div>
                <table class="ov-platform-table">
                    <thead><tr><th>Tháng ▾</th>${showMonths.map(m => `<th>${m}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${fields.map(f => `<tr><td>${f.label}</td>${showMonths.map(m => {
                            const val = chData.filter(r => r.thang === m).reduce((s, r) => s + DataService.parseNumber(r[f.key]), 0);
                            return `<td>${this.formatCompact(val)}</td>`;
                        }).join('')}</tr>`).join('')}
                    </tbody>
                </table>
                <div class="ov-platform-pagination">
                    <span>1 - ${months.length} / ${months.length}</span>
                    <button>&lt;</button><button>&gt;</button>
                </div>
            </div>`;
        }).join('');
    },

    renderOvCharts(data) {
        // STT Line chart
        const months = [...new Set(data.map(r => r.thang).filter(Boolean))].sort();
        const sttByMonth = months.map(m => data.filter(r => r.thang === m).reduce((s, r) => s + DataService.parseNumber(r.stt), 0));
        this.createLineChart('chart-ov-stt-line', months, sttByMonth, 'STT');

        // Doanh số theo kênh (Pie)
        const channels = [...new Set(data.map(r => r.kenh).filter(Boolean))];
        const dsByChannel = channels.map(c => data.filter(r => r.kenh === c).reduce((s, r) => s + DataService.parseNumber(r.doanhSoKyVong), 0));
        ChartManager.createBudgetDoughnut('chart-ov-channel-pie', channels.length > 0 ? channels : ['N/A'], dsByChannel.length > 0 ? dsByChannel : [1]);

        // Tháng theo STT (Pie)
        ChartManager.createBudgetDoughnut('chart-ov-month-pie', months.length > 0 ? months : ['N/A'], sttByMonth.length > 0 ? sttByMonth : [1]);

        // Số đơn hàng kỳ vọng (Bar by month)
        const ordersByMonth = months.map(m => data.filter(r => r.thang === m).reduce((s, r) => s + DataService.parseNumber(r.soDonHangKyVong), 0));
        this.createSimpleBarChart('chart-ov-orders-bar', months, ordersByMonth, 'Số đơn hàng kỳ vọng', '#f9a825');
    },

    createLineChart(canvasId, labels, values, label) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
        new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data: values,
                    borderColor: '#4a90d9',
                    backgroundColor: 'rgba(74,144,217,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#4a90d9',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top' } },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => this.formatCompact(v) } }
                }
            }
        });
    },

    renderOvTables(data) {
        const colors = ['#4a90d9', '#f9a825', '#a855f7', '#22c55e', '#ec4899', '#f97316'];
        // Monthly table with colored bars
        const months = [...new Set(data.map(r => r.thang).filter(Boolean))].sort();
        const monthSTTs = months.map(m => data.filter(r => r.thang === m).reduce((s, r) => s + DataService.parseNumber(r.stt), 0));
        const monthLeads = months.map(m => data.filter(r => r.thang === m).reduce((s, r) => s + DataService.parseNumber(r.soLeadThucTe), 0));
        const maxSTT = Math.max(...monthSTTs, 1);
        const maxLead = Math.max(...monthLeads, 1);

        document.getElementById('ovMonthlyBody').innerHTML = months.map((m, i) => {
            const mData = data.filter(r => r.thang === m);
            const stt = monthSTTs[i];
            const lead = monthLeads[i];
            const sttW = Math.round((stt / maxSTT) * 100);
            const leadW = Math.round((lead / maxLead) * 100);
            return `<tr>
                <td>${i + 1}. ${m}</td>
                <td><div class="ov-bar-cell"><span class="ov-bar-inner" style="width:${sttW}%;background:${colors[i % colors.length]}"></span> ${this.formatCompact(stt)}</div></td>
                <td><div class="ov-bar-cell"><span class="ov-bar-inner" style="width:${leadW}%;background:${colors[(i + 2) % colors.length]}"></span> ${this.formatCompact(lead)}</div></td>
                <td>${mData.length}</td>
            </tr>`;
        }).join('');

        // Summary by campaign type with colored cells
        const types = [...new Set(data.map(r => r.loaiChienDich).filter(Boolean))];
        const cellColors = ['#e3f2fd', '#fff3e0', '#e8f5e9', '#fce4ec', '#f3e5f5', '#e0f7fa', '#fff8e1'];
        document.getElementById('ovSummaryBody').innerHTML = types.map((t, ti) => {
            const tData = data.filter(r => r.loaiChienDich === t);
            const vals = [
                tData.reduce((s, r) => s + DataService.parseNumber(r.doanhSoKyVong), 0),
                tData.reduce((s, r) => s + DataService.parseNumber(r.nganSachQCDuKien), 0),
                tData.reduce((s, r) => s + DataService.parseNumber(r.doanhSoThucTe), 0),
                tData.reduce((s, r) => s + DataService.parseNumber(r.stt), 0),
                tData.reduce((s, r) => s + DataService.parseNumber(r.soLeadThucTe), 0),
                tData.length,
                tData.reduce((s, r) => s + DataService.parseNumber(r.soLeadThucTe), 0),
                tData.reduce((s, r) => s + DataService.parseNumber(r.soDonHangKyVong), 0),
            ];
            return `<tr>
                <td>${this.escapeHtml(t)}</td>
                ${vals.map((v, vi) => `<td><span class="ov-colored-val" style="background:${cellColors[vi % cellColors.length]}">${typeof v === 'number' ? this.formatNumber(v) : v}</span></td>`).join('')}
            </tr>`;
        }).join('');
    },


    // ============================================
    // FACEBOOK PAGE
    // ============================================

    renderFacebook() {
        const allFb = this.data.fbAds || [];
        const fb = this.filterByMonth(allFb);

        // Apply local FB filters
        const filtered = this.applyFbFilters(fb);

        // --- KPIs ---
        const totalSpend = filtered.reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0);
        const totalImpressions = filtered.reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0);
        const totalReach = filtered.reduce((s, r) => s + DataService.parseNumber(r.reach), 0);

        document.getElementById('fb-record-count').textContent = filtered.length;
        document.getElementById('fb-total-spend').textContent = this.formatCompact(totalSpend);
        document.getElementById('fb-total-impressions').textContent = this.formatCompact(totalImpressions);
        document.getElementById('fb-total-reach').textContent = this.formatCompact(totalReach);

        // --- Metric Panels ---
        const totalFreq = filtered.reduce((s, r) => s + DataService.parseNumber(r.tanSuat), 0);
        const avgFreq = filtered.length > 0 ? (totalFreq / filtered.length) : 0;
        const totalLinkClicks = filtered.reduce((s, r) => s + DataService.parseNumber(r.clicks), 0);
        const totalCpcLink = filtered.reduce((s, r) => s + DataService.parseNumber(r.cpcLink || r.cpc), 0);
        const avgCpcLink = filtered.length > 0 ? (totalCpcLink / filtered.length) : 0;
        const totalShares = filtered.reduce((s, r) => s + DataService.parseNumber(r.chiaSe), 0);
        const totalReactions = filtered.reduce((s, r) => s + DataService.parseNumber(r.camXuc), 0);
        const totalComments = filtered.reduce((s, r) => s + DataService.parseNumber(r.binhLuan), 0);
        const totalClicksAll = filtered.reduce((s, r) => s + DataService.parseNumber(r.clicksAll), 0);
        const totalCpcAll = filtered.reduce((s, r) => s + DataService.parseNumber(r.cpcAll), 0);
        const avgCpcAll = filtered.length > 0 ? (totalCpcAll / filtered.length) : 0;
        const totalCpm = filtered.reduce((s, r) => s + DataService.parseNumber(r.cpm), 0);
        const avgCpm = filtered.length > 0 ? (totalCpm / filtered.length) : 0;
        const totalCtrAll = filtered.reduce((s, r) => s + DataService.parseNumber(r.ctrAll), 0);
        const avgCtrAll = filtered.length > 0 ? (totalCtrAll / filtered.length) : 0;

        document.getElementById('fb-frequency').textContent = avgFreq.toFixed(1);
        document.getElementById('fb-link-clicks').textContent = this.formatCompact(totalLinkClicks);
        document.getElementById('fb-cpc').textContent = this.formatCompact(avgCpcLink);
        document.getElementById('fb-shares').textContent = this.formatCompact(totalShares);
        document.getElementById('fb-reactions').textContent = this.formatCompact(totalReactions);
        document.getElementById('fb-comments').textContent = this.formatCompact(totalComments);
        document.getElementById('fb-clicks-all').textContent = this.formatCompact(totalClicksAll);
        document.getElementById('fb-cpc-all').textContent = this.formatCompact(avgCpcAll);
        document.getElementById('fb-cpm').textContent = this.formatCompact(avgCpm);
        document.getElementById('fb-ctr-all').textContent = avgCtrAll.toFixed(1) + '%';

        // --- Populate filters (only if not already populated) ---
        this.populateFbFilter('fb-filter-ad', fb, 'tenQC', 'Tên quảng cáo');
        this.populateFbFilter('fb-filter-adgroup', fb, 'tenNhomQC', 'Tên nhóm quảng cáo');
        this.populateFbFilter('fb-filter-campaign', fb, 'tenChienDich', 'Tên chiến dịch');
        this.populateFbFilter('fb-filter-type', fb, 'loaiChienDich', 'Loại chiến dịch');
        this.populateFbFilter('fb-filter-account', fb, 'tenTaiKhoan', 'Tên tài khoản');

        // --- Pie Chart: Budget by campaign ---
        const campaigns = [...new Set(filtered.map(r => r.tenChienDich).filter(Boolean))];
        const campaignSpend = campaigns.map(c => filtered.filter(r => r.tenChienDich === c).reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0));
        ChartManager.createBudgetDoughnut('chart-fb-pie', campaigns.length > 0 ? campaigns : ['Không có dữ liệu'], campaignSpend.length > 0 ? campaignSpend : [1]);

        // --- Bar Chart: Reach by ad group ---
        const adGroups = [...new Set(filtered.map(r => r.tenNhomQC).filter(Boolean))];
        const adGroupReach = adGroups.map(g => filtered.filter(r => r.tenNhomQC === g).reduce((s, r) => s + DataService.parseNumber(r.reach), 0));
        this.createSimpleBarChart('chart-fb-reach', adGroups, adGroupReach, 'Người tiếp cận', '#6366f1');

        // --- Bar Chart: Impressions by ad group ---
        const adGroupImpressions = adGroups.map(g => filtered.filter(r => r.tenNhomQC === g).reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0));
        this.createSimpleBarChart('chart-fb-impressions-bar', adGroups, adGroupImpressions, 'Lượt hiển thị', '#ec4899');

        // --- Line Chart: Impressions over time ---
        const dates = [...new Set(filtered.map(r => r.ngay).filter(Boolean))].sort();
        const impressionsByDate = dates.map(d => filtered.filter(r => r.ngay === d).reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0));
        ChartManager.createPlatformTrend('chart-fb-trend', dates.length > 0 ? dates : ['N/A'], [
            { label: 'Lượt hiển thị', data: impressionsByDate.length > 0 ? impressionsByDate : [0] }
        ]);

        // --- Horizontal Bar Chart: Conversions (Lượt mua vs Hoàn tất đăng ký) ---
        const convCanvas = document.getElementById('chart-fb-conversions');
        if (convCanvas) {
            const types = [...new Set(filtered.map(r => r.loaiChienDich).filter(Boolean))];
            const typeSpend = types.map(t => filtered.filter(r => r.loaiChienDich === t).reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0));
            const typeReach = types.map(t => filtered.filter(r => r.loaiChienDich === t).reduce((s, r) => s + DataService.parseNumber(r.reach), 0));
            const existChart = Chart.getChart(convCanvas);
            if (existChart) existChart.destroy();
            new Chart(convCanvas, {
                type: 'bar',
                data: {
                    labels: types.length > 0 ? types : ['N/A'],
                    datasets: [
                        { label: 'Chi tiêu', data: typeSpend.length > 0 ? typeSpend : [0], backgroundColor: '#8b6f47' },
                        { label: 'Tiếp cận', data: typeReach.length > 0 ? typeReach : [0], backgroundColor: '#c97d60' }
                    ]
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }

        // --- Table with colored cells ---
        const tbody = document.getElementById('fbTableBody');
        const maxSpend = Math.max(...filtered.map(r => DataService.parseNumber(r.chiTieu)), 1);
        const maxImp = Math.max(...filtered.map(r => DataService.parseNumber(r.hienThi)), 1);
        const maxReach = Math.max(...filtered.map(r => DataService.parseNumber(r.reach)), 1);
        tbody.innerHTML = filtered.map(row => {
            const sp = DataService.parseNumber(row.chiTieu);
            const im = DataService.parseNumber(row.hienThi);
            const rc = DataService.parseNumber(row.reach);
            const spOpacity = (sp / maxSpend * 0.5 + 0.1).toFixed(2);
            const imOpacity = (im / maxImp * 0.5 + 0.1).toFixed(2);
            const rcOpacity = (rc / maxReach * 0.5 + 0.1).toFixed(2);
            return `<tr>
            <td>${this.escapeHtml(row.tenNhomQC || '')}</td>
            <td>${this.escapeHtml(row.tenChienDich || '')}</td>
            <td>${this.escapeHtml(row.loaiChienDich || '')}</td>
            <td style="background:rgba(76,175,80,${spOpacity});color:#fff;font-weight:600">${this.formatCompact(sp)}</td>
            <td style="background:rgba(139,111,71,${imOpacity});color:#fff;font-weight:600">${this.formatCompact(im)}</td>
            <td style="background:rgba(198,40,40,${rcOpacity});color:#fff;font-weight:600">${this.formatCompact(rc)}</td>
        </tr>`;
        }).join('');
    },

    /**
     * Compact number format: 12345 → 12,3 N; 1234567 → 1,23 Tr
     */
    formatCompact(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace('.', ',') + ' Tỷ';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.', ',') + ' Tr';
        if (num >= 1000) return (num / 1000).toFixed(1).replace('.', ',') + ' N';
        if (Number.isInteger(num)) return num.toLocaleString('vi-VN');
        return num.toFixed(1).replace('.', ',');
    },

    /**
     * Populate a filter dropdown (always refreshes options for cascading)
     */
    populateFilter(selectId, data, field, defaultText) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        const values = [...new Set(data.map(r => r[field]).filter(Boolean))].sort();
        select.innerHTML = `<option value="">${defaultText}</option>` + values.map(v => `<option value="${this.escapeHtml(v)}">${this.escapeHtml(v)}</option>`).join('');
        // Restore previous selection if still valid
        if (currentVal && values.includes(currentVal)) {
            select.value = currentVal;
        }
    },

    populateFbFilter(selectId, data, field, defaultText) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentVal = select.value;
        const values = [...new Set(data.map(r => r[field]).filter(Boolean))].sort();
        // Only repopulate if options changed
        if (select.options.length - 1 === values.length) return;
        select.innerHTML = `<option value="">${defaultText}</option>` + values.map(v => `<option value="${this.escapeHtml(v)}">${this.escapeHtml(v)}</option>`).join('');
        select.value = currentVal;
    },

    /**
     * Apply FB page filters
     */
    applyFbFilters(data) {
        let result = data;
        const filters = [
            { id: 'fb-filter-ad', field: 'tenQC' },
            { id: 'fb-filter-adgroup', field: 'tenNhomQC' },
            { id: 'fb-filter-campaign', field: 'tenChienDich' },
            { id: 'fb-filter-type', field: 'loaiChienDich' },
            { id: 'fb-filter-account', field: 'tenTaiKhoan' },
        ];
        filters.forEach(f => {
            const el = document.getElementById(f.id);
            if (el && el.value) {
                result = result.filter(r => r[f.field] === el.value);
            }
        });
        return result;
    },

    /**
     * Create a simple bar chart
     */
    createSimpleBarChart(canvasId, labels, data, label, color) {
        ChartManager.destroy(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        ChartManager.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    backgroundColor: color + '99',
                    hoverBackgroundColor: color,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: ChartManager.defaults.borderColor, drawBorder: false }, beginAtZero: true }
                }
            }
        });
    },

    // ============================================
    // FB ADS TIN NHẮN PAGE
    // ============================================

    renderFbMessage() {
        const allData = this.data.fbMessage || [];
        const fb = this.filterByMonth(allData);
        const filtered = this.applyFbmFilters(fb);

        const totalSpend = filtered.reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0);
        const totalImpressions = filtered.reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0);
        const totalReach = filtered.reduce((s, r) => s + DataService.parseNumber(r.reach), 0);

        document.getElementById('fbm-record-count').textContent = filtered.length;
        document.getElementById('fbm-total-spend').textContent = this.formatCompact(totalSpend);
        document.getElementById('fbm-total-impressions').textContent = this.formatCompact(totalImpressions);
        document.getElementById('fbm-total-reach').textContent = this.formatCompact(totalReach);

        // Metric Panels
        const avgFreq = filtered.length > 0 ? filtered.reduce((s, r) => s + DataService.parseNumber(r.tanSuat), 0) / filtered.length : 0;
        const totalLinkClicks = filtered.reduce((s, r) => s + DataService.parseNumber(r.clicks), 0);
        const avgCpc = filtered.length > 0 ? filtered.reduce((s, r) => s + DataService.parseNumber(r.cpcLink || r.cpc), 0) / filtered.length : 0;
        const totalShares = filtered.reduce((s, r) => s + DataService.parseNumber(r.chiaSe), 0);
        const totalReactions = filtered.reduce((s, r) => s + DataService.parseNumber(r.camXuc), 0);
        const totalComments = filtered.reduce((s, r) => s + DataService.parseNumber(r.binhLuan), 0);
        
        const totalClicksAll = filtered.reduce((s, r) => s + DataService.parseNumber(r.soLanNhapTatCa || r.clicksAll || r.clicks), 0);
        const avgCpcAll = totalClicksAll > 0 ? (totalSpend / totalClicksAll) : 0;
        const avgCpm = filtered.length > 0 ? filtered.reduce((s, r) => s + DataService.parseNumber(r.cpm), 0) / filtered.length : 0;
        const avgCtrAll = filtered.length > 0 ? filtered.reduce((s, r) => s + DataService.parseNumber(r.ctrAll), 0) / filtered.length : 0;

        document.getElementById('fbm-frequency').textContent = avgFreq.toFixed(1);
        document.getElementById('fbm-link-clicks').textContent = this.formatCompact(totalLinkClicks);
        document.getElementById('fbm-cpc').textContent = this.formatVND(avgCpc);
        document.getElementById('fbm-shares').textContent = this.formatCompact(totalShares);
        document.getElementById('fbm-reactions').textContent = this.formatCompact(totalReactions);
        document.getElementById('fbm-comments').textContent = this.formatCompact(totalComments);
        document.getElementById('fbm-clicks-all').textContent = this.formatCompact(totalClicksAll);
        document.getElementById('fbm-cpc-all').textContent = this.formatVND(avgCpcAll);
        document.getElementById('fbm-cpm').textContent = this.formatVND(avgCpm);
        document.getElementById('fbm-ctr-all').textContent = avgCtrAll.toFixed(1) + '%';

        // Filters
        this.populateFbFilter('fbm-filter-ad', fb, 'tenQC', 'Tên quảng cáo');
        this.populateFbFilter('fbm-filter-adgroup', fb, 'tenNhomQC', 'Tên nhóm quảng cáo');
        this.populateFbFilter('fbm-filter-campaign', fb, 'tenChienDich', 'Tên chiến dịch');
        this.populateFbFilter('fbm-filter-type', fb, 'loaiChienDich', 'Loại chiến dịch');
        this.populateFbFilter('fbm-filter-account', fb, 'tenTaiKhoan', 'Tên tài khoản');

        // Charts
        const campaigns = [...new Set(filtered.map(r => r.tenChienDich).filter(Boolean))];
        const campaignSpend = campaigns.map(c => filtered.filter(r => r.tenChienDich === c).reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0));
        ChartManager.createBudgetDoughnut('chart-fbm-pie', campaigns.length > 0 ? campaigns : ['N/A'], campaignSpend.length > 0 ? campaignSpend : [1]);

        const adGroups = [...new Set(filtered.map(r => r.tenNhomQC).filter(Boolean))];
        const adGroupReach = adGroups.map(g => filtered.filter(r => r.tenNhomQC === g).reduce((s, r) => s + DataService.parseNumber(r.reach), 0));
        this.createSimpleBarChart('chart-fbm-reach', adGroups, adGroupReach, 'Người tiếp cận', '#6366f1');

        const adGroupImpressions = adGroups.map(g => filtered.filter(r => r.tenNhomQC === g).reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0));
        this.createSimpleBarChart('chart-fbm-impressions-bar', adGroups, adGroupImpressions, 'Lượt hiển thị', '#ec4899');

        const dates = [...new Set(filtered.map(r => r.ngay).filter(Boolean))].sort();
        const impressionsByDate = dates.map(d => filtered.filter(r => r.ngay === d).reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0));
        ChartManager.createPlatformTrend('chart-fbm-trend', dates.length > 0 ? dates : ['N/A'], [
            { label: 'Lượt hiển thị', data: impressionsByDate.length > 0 ? impressionsByDate : [0] }
        ]);

        // Bottom chart: Lượt hiển thị theo chiến dịch
        const campaignImpressions = campaigns.map(c => filtered.filter(r => r.tenChienDich === c).reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0));
        const topCampImps = campaigns.map((c, i) => ({c, imp: campaignImpressions[i]})).sort((a,b)=>b.imp-a.imp).slice(0, 10);
        this.createSimpleBarChart('chart-fbm-impressions-campaign', topCampImps.length > 0 ? topCampImps.map(x=>x.c) : ['N/A'], topCampImps.length > 0 ? topCampImps.map(x=>x.imp) : [0], 'Lượt hiển thị', '#6366f1');

        // Table with heatmap styling
        const maxSpend = Math.max(...filtered.map(r => DataService.parseNumber(r.chiTieu)), 1);
        const maxImp = Math.max(...filtered.map(r => DataService.parseNumber(r.hienThi)), 1);
        const maxReach = Math.max(...filtered.map(r => DataService.parseNumber(r.reach)), 1);

        document.getElementById('fbmTableBody').innerHTML = filtered.map(row => {
            const spend = DataService.parseNumber(row.chiTieu);
            const imp = DataService.parseNumber(row.hienThi);
            const reach = DataService.parseNumber(row.reach);
            
            const spendOp = Math.max(0.05, spend / maxSpend);
            const impOp = Math.max(0.05, imp / maxImp);
            const reachOp = Math.max(0.05, reach / maxReach);

            return `<tr>
                <td style="text-align:left">${this.escapeHtml(row.tenNhomQC || '')}</td>
                <td style="text-align:left">${this.escapeHtml(row.tenChienDich || '')}</td>
                <td style="text-align:left">${this.escapeHtml(row.loaiChienDich || '')}</td>
                <td style="background: rgba(59, 130, 246, ${spendOp})">${this.formatCompact(spend)}</td>
                <td style="background: rgba(234, 179, 8, ${impOp})">${this.formatCompact(imp)}</td>
                <td style="background: rgba(239, 68, 68, ${reachOp})">${this.formatCompact(reach)}</td>
            </tr>`;
        }).join('');
    },

    applyFbmFilters(data) {
        let result = data;
        [{ id: 'fbm-filter-ad', field: 'tenQC' }, { id: 'fbm-filter-adgroup', field: 'tenNhomQC' },
         { id: 'fbm-filter-campaign', field: 'tenChienDich' }, { id: 'fbm-filter-type', field: 'loaiChienDich' },
         { id: 'fbm-filter-account', field: 'tenTaiKhoan' }].forEach(f => {
            const el = document.getElementById(f.id);
            if (el && el.value) result = result.filter(r => r[f.field] === el.value);
        });
        return result;
    },

    // ============================================
    // CONTENT PLAN PAGE
    // ============================================

    renderContent() {
        const allData = this.data.contentPlan || [];
        const filtered = this.applyContentFilters(allData);

        const total = filtered.length;
        const totalTarget = filtered.reduce((s, r) => s + DataService.parseNumber(r.target), 0);
        const totalThucDat = filtered.reduce((s, r) => s + DataService.parseNumber(r.thucDat), 0);
        const completion = totalTarget > 0 ? ((totalThucDat / totalTarget) * 100).toFixed(0) : 0;

        document.getElementById('cp-total').textContent = total;
        document.getElementById('cp-approved').textContent = this.formatCompact(totalTarget);
        document.getElementById('cp-posted').textContent = this.formatCompact(totalThucDat);
        document.getElementById('cp-completion').textContent = completion + '%';

        // Update KPI card labels
        const labels = document.querySelectorAll('#page-content .fb-kpi-label');
        if (labels.length >= 4) {
            labels[0].textContent = 'Record Count';
            labels[1].textContent = 'Target';
            labels[2].textContent = 'Thực đạt';
            labels[3].textContent = 'Tỷ lệ hoàn thành';
        }

        // Filters
        this.populateFbFilter('cp-filter-channel', allData, 'kenh', 'Kênh');
        this.populateFbFilter('cp-filter-type', allData, 'loaiContent', 'Loại content');
        this.populateFbFilter('cp-filter-person', allData, 'tenNhanVien', 'Nhân viên');
        this.populateFbFilter('cp-filter-status', allData, 'trangThai', 'Trạng thái');

        // Charts
        const types = [...new Set(filtered.map(r => r.loaiContent).filter(Boolean))];
        const typeCounts = types.map(t => filtered.filter(r => r.loaiContent === t).length);
        ChartManager.createBudgetDoughnut('chart-cp-type', types.length > 0 ? types : ['N/A'], typeCounts.length > 0 ? typeCounts : [1]);

        const channels = [...new Set(filtered.map(r => r.kenh).filter(Boolean))];
        const channelCounts = channels.map(c => filtered.filter(r => r.kenh === c).length);
        this.createSimpleBarChart('chart-cp-channel', channels, channelCounts, 'Nội dung', '#6366f1');

        const statuses = [...new Set(filtered.map(r => r.trangThai).filter(Boolean))];
        const statusCounts = statuses.map(s => filtered.filter(r => r.trangThai === s).length);
        ChartManager.createBudgetDoughnut('chart-cp-status', statuses.length > 0 ? statuses : ['N/A'], statusCounts.length > 0 ? statusCounts : [1]);

        // Table
        document.getElementById('cpTableBody').innerHTML = filtered.map(row => {
            const pct = DataService.parseNumber(row.tyLeHoanThanh);
            const statusClass = (row.trangThai || '').includes('Đúng hạn') ? 'positive' : 
                                (row.trangThai || '').includes('Quá hạn') ? 'negative' : '';
            return `<tr>
            <td>${this.escapeHtml(row.stt || '')}</td>
            <td>${this.escapeHtml(row.tenNhanVien || '')}</td>
            <td>${this.escapeHtml(row.tenChienDich || '')}</td>
            <td>${this.escapeHtml(row.loaiContent || '')}</td>
            <td>${this.escapeHtml(row.kenh || '')}</td>
            <td>${this.escapeHtml(row.donVi || '')}</td>
            <td>${this.escapeHtml(row.target || '')}</td>
            <td>${this.escapeHtml(row.thucDat || '')}</td>
            <td><span class="kpi-change ${statusClass}">${row.tyLeHoanThanh || '0%'}</span></td>
            <td><span class="kpi-change ${statusClass}">${this.escapeHtml(row.trangThai || '')}</span></td>
        </tr>`;
        }).join('');
    },

    applyContentFilters(data) {
        let result = data;
        [{ id: 'cp-filter-channel', field: 'kenh' }, { id: 'cp-filter-type', field: 'loaiContent' },
         { id: 'cp-filter-person', field: 'tenNhanVien' }, { id: 'cp-filter-status', field: 'trangThai' }].forEach(f => {
            const el = document.getElementById(f.id);
            if (el && el.value) result = result.filter(r => r[f.field] === el.value);
        });
        return result;
    },

    // ============================================
    // GOOGLE ADS PAGE
    // ============================================

    renderGoogle() {
        const gg = this.filterByMonth(this.data.googleAds);
        const totalSpending = gg.reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0);
        const totalClicks = gg.reduce((s, r) => s + DataService.parseNumber(r.clicks), 0);
        const totalImpressions = gg.reduce((s, r) => s + DataService.parseNumber(r.hienThi), 0);
        const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : 0;

        this.animateValue('kpi-gg-spending', totalSpending, true);
        this.animateValue('kpi-gg-clicks', totalClicks, false);
        this.animateValue('kpi-gg-impressions', totalImpressions, false);
        document.getElementById('kpi-gg-ctr').textContent = ctr + '%';

        const campaigns = [...new Set(gg.map(r => r.tenChienDich))];
        const spendData = campaigns.map(c => gg.filter(r => r.tenChienDich === c).reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0));
        const clickData = campaigns.map(c => gg.filter(r => r.tenChienDich === c).reduce((s, r) => s + DataService.parseNumber(r.clicks), 0));

        ChartManager.createPlatformTrend('chart-gg-trend', campaigns, [
            { label: 'Chi tiêu', data: spendData },
            { label: 'Clicks', data: clickData, yAxisID: 'y1' }
        ]);

        const tbody = document.getElementById('ggTableBody');
        tbody.innerHTML = gg.map(row => `<tr>
            <td>${this.escapeHtml(row.ngay || '')}</td>
            <td>${this.escapeHtml(row.tenChienDich || '')}</td>
            <td>${this.formatVND(DataService.parseNumber(row.chiTieu))}</td>
            <td>${DataService.parseNumber(row.clicks).toLocaleString('vi-VN')}</td>
            <td>${DataService.parseNumber(row.hienThi).toLocaleString('vi-VN')}</td>
        </tr>`).join('');
    },

    // ============================================
    // TIKTOK PAGE
    // ============================================

    renderTiktok() {
        const tt = this.filterByMonth(this.data.tiktokAds);
        const totalSpending = tt.reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0);
        const totalClicks = tt.reduce((s, r) => s + DataService.parseNumber(r.clicks), 0);
        const totalOrders = tt.reduce((s, r) => s + DataService.parseNumber(r.donHang), 0);
        const totalRevenue = tt.reduce((s, r) => s + DataService.parseNumber(r.doanhSo), 0);

        this.animateValue('kpi-tt-spending', totalSpending, true);
        this.animateValue('kpi-tt-clicks', totalClicks, false);
        this.animateValue('kpi-tt-orders', totalOrders, false);
        this.animateValue('kpi-tt-revenue', totalRevenue, true);

        const campaigns = [...new Set(tt.map(r => r.tenChienDich))];
        const spendData = campaigns.map(c => tt.filter(r => r.tenChienDich === c).reduce((s, r) => s + DataService.parseNumber(r.chiTieu), 0));
        const revData = campaigns.map(c => tt.filter(r => r.tenChienDich === c).reduce((s, r) => s + DataService.parseNumber(r.doanhSo), 0));

        ChartManager.createPlatformTrend('chart-tt-trend', campaigns, [
            { label: 'Chi tiêu', data: spendData },
            { label: 'Doanh số', data: revData }
        ]);

        const tbody = document.getElementById('ttTableBody');
        tbody.innerHTML = tt.map(row => `<tr>
            <td>${this.escapeHtml(row.ngay || '')}</td>
            <td>${this.escapeHtml(row.tenChienDich || '')}</td>
            <td>${this.formatVND(DataService.parseNumber(row.chiTieu))}</td>
            <td>${DataService.parseNumber(row.clicks).toLocaleString('vi-VN')}</td>
            <td>${DataService.parseNumber(row.hienThi).toLocaleString('vi-VN')}</td>
            <td>${DataService.parseNumber(row.donHang).toLocaleString('vi-VN')}</td>
            <td>${this.formatVND(DataService.parseNumber(row.doanhSo))}</td>
        </tr>`).join('');
    },

    // ============================================
    // KPI PAGE
    // ============================================

    renderKPI() {
        const allKpis = this.data.kpis || [];
        const kpis = this.filterByMonth(allKpis);

        // Group by tên nhân viên and calculate average % hoàn thành
        const people = [...new Set(kpis.map(r => r.tenNhanVien).filter(Boolean))];
        const kpiLabels = people;
        const kpiValues = people.map(p => {
            const rows = kpis.filter(r => r.tenNhanVien === p);
            const vals = rows.map(r => DataService.parseNumber(r._col21));
            return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        });

        ChartManager.createKPIChart('chart-kpi-progress', kpiLabels, kpiValues);

        const tbody = document.getElementById('kpiTableBody');
        tbody.innerHTML = kpis.map(row => {
            const pct = DataService.parseNumber(row._col21);
            const colorClass = pct >= 100 ? 'positive' : pct >= 80 ? '' : 'negative';
            return `<tr>
                <td>${this.escapeHtml(row.tenNhanVien || '')}</td>
                <td>${this.escapeHtml(row.boPhan || '')}</td>
                <td title="${this.escapeHtml(row.kpi || '')}">${this.escapeHtml(row.kpi || '')}</td>
                <td>${this.escapeHtml(row._col10 || '')}</td>
                <td>${this.escapeHtml(row._col19 || '')}</td>
                <td>${this.escapeHtml(row._col20 || '')}</td>
                <td><span class="kpi-change ${colorClass}">${row._col21 || '0%'}</span></td>
                <td>
                    <div class="progress-bar"><div class="progress-bar-fill" style="width: ${Math.min(pct, 100)}%"></div></div>
                </td>
            </tr>`;
        }).join('');
    },

    // ============================================
    // TASKS PAGE
    // ============================================

    renderTasks() {
        const allTasks = this.filterByMonth(this.data.tasks);

        // Populate filter dropdowns (from FULL dataset, not filtered)
        this.setupTaskFilters(this.data.tasks);

        // Apply filters
        const statusFilter = document.getElementById('taskFilterStatus')?.value || 'all';
        const personFilter = document.getElementById('taskFilterPerson')?.value || 'all';
        let tasks = allTasks;
        if (statusFilter !== 'all') {
            tasks = tasks.filter(t => (t.trangThai || '') === statusFilter);
        }
        if (personFilter !== 'all') {
            tasks = tasks.filter(t => (t.nguoiThucHien || '') === personFilter);
        }

        const total = tasks.length;

        // Average progress across all tasks (the main "Tiến độ" gauge)
        const avgProgress = total > 0 
            ? tasks.reduce((s, t) => s + DataService.parseNumber(t.tienDo), 0) / total 
            : 0;

        // Count completed: only tasks with tiến độ = 100%
        const doneCount = tasks.filter(t => DataService.parseNumber(t.tienDo) >= 100).length;

        // In-progress: tiến độ > 0 and < 100
        const inProgress = tasks.filter(t => {
            const prog = DataService.parseNumber(t.tienDo);
            return prog > 0 && prog < 100;
        }).length;

        // On-time / overdue
        // Smart detection: if deadline has passed and task is NOT marked as "Đúng hạn", it's overdue
        const now = new Date();
        now.setHours(23, 59, 59, 999); // End of today
        
        const ontime = tasks.filter(t => {
            const s = (t.trangThai || '').toLowerCase();
            // Explicitly marked as on-time or completed
            if (s.includes('đúng hạn') || s.includes('hoàn thành') || s.includes('done')) return true;
            // Has completion date before/on deadline = on-time
            if (t.ngayHoanThanh && t.deadline) {
                const completed = this.parseDate(t.ngayHoanThanh);
                const deadline = this.parseDate(t.deadline);
                if (completed && deadline && completed <= deadline) return true;
            }
            return false;
        }).length;
        
        const overdue = tasks.filter(t => {
            const s = (t.trangThai || '').toLowerCase();
            // Explicitly marked as overdue
            if (s.includes('quá hạn')) return true;
            // NOT marked as on-time + deadline has passed = overdue
            if (s.includes('đúng hạn') || s.includes('hoàn thành') || s.includes('done')) return false;
            if (t.deadline) {
                const deadline = this.parseDate(t.deadline);
                if (deadline && deadline < now) return true;
            }
            return false;
        }).length;

        // Quality: tasks where trưởng phòng has checked
        const qualityPass = tasks.filter(t => (t.truongPhongCheck || '').toUpperCase() === 'OK').length;
        const qualityFail = tasks.filter(t => {
            const check = (t.truongPhongCheck || '').trim().toUpperCase();
            return check !== '' && check !== 'OK';
        }).length;
        const checkedTotal = qualityPass + qualityFail;

        // Rates
        const completionRate = avgProgress; // Average of all tiến độ values
        const evaluatedTotal = ontime + overdue;
        const ontimeRate = evaluatedTotal > 0 ? (ontime / evaluatedTotal * 100) : (total > 0 ? 0 : 100);
        const qualityRate = checkedTotal > 0 ? (qualityPass / checkedTotal * 100) : (total > 0 ? 0 : 100);

        // Update KPI numbers
        document.getElementById('task-total').textContent = total;
        document.getElementById('task-done').textContent = doneCount;
        document.getElementById('task-progress').textContent = inProgress;
        document.getElementById('task-ontime').textContent = ontime;
        document.getElementById('task-overdue').textContent = overdue;
        document.getElementById('task-quality-pass').textContent = qualityPass;
        document.getElementById('task-quality-fail').textContent = qualityFail;

        // Update gauge values
        document.getElementById('gauge-completion-val').textContent = completionRate.toFixed(1) + '%';
        document.getElementById('gauge-ontime-val').textContent = ontimeRate.toFixed(1) + '%';
        document.getElementById('gauge-quality-val').textContent = qualityRate.toFixed(1) + '%';

        // Draw gauges
        ChartManager.drawGauge('gauge-completion', completionRate, '#22c55e', '#eab308');
        ChartManager.drawGauge('gauge-ontime', ontimeRate, '#06b6d4', '#f97316');
        ChartManager.drawGauge('gauge-quality', qualityRate, '#f97316', '#ef4444');

        // Per-person bar charts
        const people = [...new Set(allTasks.map(t => t.nguoiThucHien).filter(Boolean))];
        const qualityByPerson = people.map(p => {
            const pTasks = allTasks.filter(t => t.nguoiThucHien === p);
            const checked = pTasks.filter(t => (t.truongPhongCheck || '').trim() !== '');
            if (checked.length === 0) return 0;
            const pass = checked.filter(t => (t.truongPhongCheck || '').toUpperCase() === 'OK').length;
            return (pass / checked.length * 100);
        });
        const ontimeByPerson = people.map(p => {
            const pTasks = allTasks.filter(t => t.nguoiThucHien === p);
            // All tasks with a deadline are evaluatable
            const withDeadline = pTasks.filter(t => t.deadline && this.parseDate(t.deadline));
            if (withDeadline.length === 0) return 0;
            const ot = withDeadline.filter(t => {
                const s = (t.trangThai || '').toLowerCase();
                return s.includes('đúng hạn') || s.includes('hoàn thành') || s.includes('done');
            }).length;
            return (ot / withDeadline.length * 100);
        });

        ChartManager.createTaskPersonBar('chart-task-quality', people, qualityByPerson, 'Tỷ lệ đạt chất lượng', '#eab308');
        ChartManager.createTaskPersonBar('chart-task-ontime', people, ontimeByPerson, 'Tỷ lệ đúng hạn', '#06b6d4');

        // Table
        const tbody = document.getElementById('taskTableBody');
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        tbody.innerHTML = tasks.map((row, idx) => {
            const progress = DataService.parseNumber(row.tienDo);
            const progressClass = progress >= 100 ? 'positive' : progress >= 50 ? '' : 'negative';
            
            // Auto-detect status: if empty and deadline passed → Quá hạn
            let displayStatus = row.trangThai || '';
            if (!displayStatus.trim() && row.deadline) {
                const dl = this.parseDate(row.deadline);
                if (dl && dl < today && progress < 100) {
                    displayStatus = 'Quá hạn';
                }
            }
            const status = this.getTaskStatusBadge(displayStatus);

            return `<tr>
                <td>${row.stt || idx + 1}</td>
                <td>${this.escapeHtml(row.deadline || '')}</td>
                <td title="${this.escapeHtml(row.nhiemVu || '')}">${this.escapeHtml(row.nhiemVu || '')}</td>
                <td>${this.escapeHtml(row.nguoiThucHien || '')}</td>
                <td>${status}</td>
                <td>
                    <div class="progress-bar"><div class="progress-bar-fill" style="width: ${Math.min(progress, 100)}%"></div></div>
                    <span class="kpi-change ${progressClass}">${progress}%</span>
                </td>
            </tr>`;
        }).join('');
    },

    setupTaskFilters(allTasks) {
        const statusEl = document.getElementById('taskFilterStatus');
        const personEl = document.getElementById('taskFilterPerson');
        if (!statusEl || !personEl) return;

        // Only populate once
        if (!this._taskFiltersSetup) {
            const statuses = [...new Set(allTasks.map(t => t.trangThai).filter(Boolean))];
            statuses.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                statusEl.appendChild(opt);
            });

            const people = [...new Set(allTasks.map(t => t.nguoiThucHien).filter(Boolean))];
            people.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                personEl.appendChild(opt);
            });

            statusEl.addEventListener('change', () => this.renderTasks());
            personEl.addEventListener('change', () => this.renderTasks());
            this._taskFiltersSetup = true;

            // Default: filter by "Tạ Ngọc Dũng"
            const defaultPerson = 'Tạ Ngọc Dũng';
            for (const opt of personEl.options) {
                if (opt.value === defaultPerson) {
                    personEl.value = defaultPerson;
                    break;
                }
            }
        }
    },

    // ============================================
    // SETTINGS MODAL
    // ============================================

    setupSettings() {
        const modal = document.getElementById('settingsModal');
        const btnSettings = document.getElementById('btnSettings');
        const btnClose = document.getElementById('modalClose');
        const btnSave = document.getElementById('btnSaveUrls');
        const btnClear = document.getElementById('btnClearUrls');
        const btnRefresh = document.getElementById('btnRefresh');

        btnSettings.addEventListener('click', () => {
            this.loadUrlsToForm();
            modal.classList.add('show');
        });

        btnClose.addEventListener('click', () => modal.classList.remove('show'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });

        btnSave.addEventListener('click', async () => {
            this.saveUrlsFromForm();
            modal.classList.remove('show');
            await this.loadData();
        });

        btnClear.addEventListener('click', () => {
            const inputs = ['url-performance', 'url-fb-conversion', 'url-fb-message', 'url-google-ads', 'url-tiktok-ads', 'url-kpi', 'url-content-plan', 'url-tasks'];
            inputs.forEach(id => document.getElementById(id).value = '');
        });

        btnRefresh.addEventListener('click', async () => {
            btnRefresh.classList.add('spinning');
            await this.loadData();
            setTimeout(() => btnRefresh.classList.remove('spinning'), 500);
        });
    },

    loadUrlsToForm() {
        CONFIG.loadUrls();
        document.getElementById('url-performance').value = CONFIG.urls.performance || '';
        document.getElementById('url-fb-conversion').value = CONFIG.urls.fbConversion || '';
        document.getElementById('url-fb-message').value = CONFIG.urls.fbMessage || '';
        document.getElementById('url-google-ads').value = CONFIG.urls.googleAds || '';
        document.getElementById('url-tiktok-ads').value = CONFIG.urls.tiktokAds || '';
        document.getElementById('url-kpi').value = CONFIG.urls.kpi || '';
        document.getElementById('url-content-plan').value = CONFIG.urls.contentPlan || '';
        document.getElementById('url-tasks').value = CONFIG.urls.tasks || '';
    },

    saveUrlsFromForm() {
        CONFIG.urls.performance = document.getElementById('url-performance').value.trim();
        CONFIG.urls.fbConversion = document.getElementById('url-fb-conversion').value.trim();
        CONFIG.urls.fbMessage = document.getElementById('url-fb-message').value.trim();
        CONFIG.urls.googleAds = document.getElementById('url-google-ads').value.trim();
        CONFIG.urls.tiktokAds = document.getElementById('url-tiktok-ads').value.trim();
        CONFIG.urls.kpi = document.getElementById('url-kpi').value.trim();
        CONFIG.urls.contentPlan = document.getElementById('url-content-plan').value.trim();
        CONFIG.urls.tasks = document.getElementById('url-tasks').value.trim();
        CONFIG.saveUrls();
    },

    // ============================================
    // SEARCH & FILTER
    // ============================================

    setupFbFilters() {
        // Overview filters
        ['ov-filter-company', 'ov-filter-channel', 'ov-filter-type'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderOverview());
        });
        // FB Chuyển đổi filters
        ['fb-filter-ad', 'fb-filter-adgroup', 'fb-filter-campaign', 'fb-filter-type', 'fb-filter-account'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderFacebook());
        });
        // FB Tin nhắn filters
        ['fbm-filter-ad', 'fbm-filter-adgroup', 'fbm-filter-campaign', 'fbm-filter-type', 'fbm-filter-account'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderFbMessage());
        });
        // Content Plan filters
        ['cp-filter-channel', 'cp-filter-type', 'cp-filter-person', 'cp-filter-status'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.renderContent());
        });
    },

    setupSearch() {
        const searchInput = document.getElementById('tableSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#campaignTableBody tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(query) ? '' : 'none';
                });
            });
        }

        // Time range filter popover
        this.setupTimeFilter();

        // Table sorting
        document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.sortTable(th));
        });
    },

    // ============================================
    // TIME RANGE FILTER
    // ============================================

    setupTimeFilter() {
        const btn = document.getElementById('timeFilterBtn');
        const popover = document.getElementById('timeFilterPopover');
        const radios = document.querySelectorAll('input[name="timeRange"]');
        const customRange = document.getElementById('customDateRange');
        const btnApply = document.getElementById('btnApplyCustomDate');

        // Toggle popover
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popover.classList.contains('show');
            popover.classList.toggle('show');
            btn.classList.toggle('active');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!popover.contains(e.target) && e.target !== btn) {
                popover.classList.remove('show');
                btn.classList.remove('active');
            }
        });

        // Radio change
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                const val = radio.value;

                // Show/hide custom date range
                if (val === 'custom') {
                    customRange.classList.add('show');
                } else {
                    customRange.classList.remove('show');
                    // Update label and close popover
                    const labels = {
                        'this_week': 'Tuần này',
                        'last_week': 'Tuần trước',
                        'this_month': 'Tháng này',
                        'last_month': 'Tháng trước',
                        'max': 'Tối đa',
                    };
                    document.getElementById('timeFilterLabel').textContent = labels[val] || val;
                    this.updateFilterDateRange();
                    popover.classList.remove('show');
                    btn.classList.remove('active');
                    this.renderCurrentPage();
                }
            });
        });

        // Apply custom date
        btnApply.addEventListener('click', () => {
            const from = document.getElementById('dateFrom').value;
            const to = document.getElementById('dateTo').value;
            if (from && to) {
                document.getElementById('timeFilterLabel').textContent = 'Tùy chỉnh';
                this.updateFilterDateRange();
                popover.classList.remove('show');
                btn.classList.remove('active');
                this.renderCurrentPage();
            }
        });

        // Show date range for default selection on load
        this.updateFilterDateRange();
    },

    /**
     * Update the filter button label to include date range
     */
    updateFilterDateRange() {
        const range = this.getTimeRange();
        const el = document.getElementById('filterDateRange');
        if (!el) return;

        if (range) {
            const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
            el.textContent = `(${fmt(range.start)} - ${fmt(range.end)})`;
        } else {
            el.textContent = '';
        }
    },

    /**
     * Get current time range based on selected filter
     * Returns { start: Date, end: Date } or null for "max"
     */
    getTimeRange() {
        const selected = document.querySelector('input[name="timeRange"]:checked');
        if (!selected) return null;

        const val = selected.value;
        const now = new Date();
        let start, end;

        switch (val) {
            case 'this_week': {
                const day = now.getDay() || 7; // Monday = 1
                start = new Date(now);
                start.setDate(now.getDate() - day + 1);
                start.setHours(0, 0, 0, 0);
                end = new Date(now);
                end.setHours(23, 59, 59, 999);
                break;
            }
            case 'last_week': {
                const day = now.getDay() || 7;
                end = new Date(now);
                end.setDate(now.getDate() - day);
                end.setHours(23, 59, 59, 999);
                start = new Date(end);
                start.setDate(end.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                break;
            }
            case 'this_month': {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now);
                end.setHours(23, 59, 59, 999);
                break;
            }
            case 'last_month': {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
            }
            case 'custom': {
                const fromVal = document.getElementById('dateFrom').value;
                const toVal = document.getElementById('dateTo').value;
                if (fromVal && toVal) {
                    start = new Date(fromVal + 'T00:00:00');
                    end = new Date(toVal + 'T23:59:59');
                } else {
                    return null;
                }
                break;
            }
            case 'max':
            default:
                return null;
        }

        return { start, end };
    },

    /**
     * Parse a date string from data.
     * Google Sheets CSV exports dates in the sheet's locale format.
     * This sheet uses Vietnamese locale: D/M/YY (e.g. "1/3/24" = March 1st)
     * Also handles: YYYY-MM-DD
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        const str = String(dateStr).trim().split(' ')[0]; // Take only date part, ignore time
        
        // Match: D/M/YY, D/M/YYYY, DD/MM/YYYY, etc.
        const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (slashMatch) {
            let p1 = parseInt(slashMatch[1]);
            let p2 = parseInt(slashMatch[2]);
            let year = parseInt(slashMatch[3]);
            
            // Handle 2-digit year: 24 → 2024, 99 → 1999
            if (year < 100) {
                year += (year < 50) ? 2000 : 1900;
            }
            
            // Vietnamese locale: D/M/Y (Day/Month/Year)
            // p1 = day, p2 = month
            // If p2 > 12, it can't be a month → swap to M/D/Y interpretation
            if (p2 > 12) {
                // p2 must be day, p1 must be month → M/D/Y
                return new Date(year, p1 - 1, p2);
            } else {
                // Default: Vietnamese D/M/Y format
                return new Date(year, p2 - 1, p1);
            }
        }
        
        // YYYY-MM-DD or YYYY/MM/DD
        const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (ymdMatch) {
            return new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
        }
        
        return null; // Don't use native Date() fallback - it's unreliable
    },

    /**
     * Filter data by the selected time range.
     * Handles multiple date field patterns:
     * - ngay: daily date (FB Ads, Google Ads, TikTok)
     * - ngayBatDau/ngayKetThuc: date ranges (Performance/Overview)
     * - ngayGiao/deadline: task dates
     * - thang + nam: month+year strings (Performance fallback)
     */
    filterByMonth(data) {
        const range = this.getTimeRange();
        if (!range) return data; // "Tối đa" - return all

        return data.filter(r => {
            // 1. Try exact date field (FB Ads, Google Ads, TikTok daily data)
            if (r.ngay) {
                const d = this.parseDate(r.ngay);
                if (d) return d >= range.start && d <= range.end;
                return false;
            }

            // 2. Try date range fields (Performance/Overview data)
            if (r.ngayBatDau || r.ngayKetThuc) {
                const startD = this.parseDate(r.ngayBatDau);
                const endD = this.parseDate(r.ngayKetThuc);
                if (startD && endD) {
                    // Row overlaps with filter range if row-start <= range-end AND row-end >= range-start
                    return startD <= range.end && endD >= range.start;
                }
                if (startD) return startD >= range.start && startD <= range.end;
                if (endD) return endD >= range.start && endD <= range.end;
            }

            // 3. Try task date fields
            if (r.deadline) {
                const d = this.parseDate(r.deadline);
                if (d) return d >= range.start && d <= range.end;
                return false;
            }
            if (r.ngayGiao) {
                const d = this.parseDate(r.ngayGiao);
                if (d) return d >= range.start && d <= range.end;
                return false;
            }

            // 4. Fall back to thang + nam fields (Performance data without dates)
            if (r.thang) {
                const m = DataService.getMonthNumber(r.thang);
                if (m > 0) {
                    // Extract year from 'nam' field (e.g. "Năm 2024" → 2024) or try all likely years
                    let year = 0;
                    if (r.nam) {
                        const yearMatch = String(r.nam).match(/(\d{4})/);
                        if (yearMatch) year = parseInt(yearMatch[1]);
                    }
                    if (!year) {
                        // No year info - include if any year of this month could overlap
                        // Try range years
                        const years = [range.start.getFullYear()];
                        if (range.end.getFullYear() !== range.start.getFullYear()) {
                            years.push(range.end.getFullYear());
                        }
                        return years.some(y => {
                            const monthStart = new Date(y, m - 1, 1);
                            const monthEnd = new Date(y, m, 0, 23, 59, 59);
                            return monthStart <= range.end && monthEnd >= range.start;
                        });
                    }
                    const monthStart = new Date(year, m - 1, 1);
                    const monthEnd = new Date(year, m, 0, 23, 59, 59);
                    return monthStart <= range.end && monthEnd >= range.start;
                }
            }

            // If no date info at all, exclude when filter is active
            // (empty/padding rows from Google Sheets should not show up)
            return false;
        });
    },

    formatDateShort(dateStr) {
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    },

    formatDateFull(date) {
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    },

    /**
     * Update the date range display next to the filter label
     */
    updateFilterDateRange() {
        const rangeEl = document.getElementById('filterDateRange');
        const range = this.getTimeRange();
        if (!range) {
            rangeEl.textContent = '';
        } else {
            rangeEl.textContent = `${this.formatDateFull(range.start)} → ${this.formatDateFull(range.end)}`;
        }
    },

    sortTable(th) {
        const table = th.closest('table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const colIdx = Array.from(th.parentElement.children).indexOf(th);
        const asc = th.dataset.sortDir !== 'asc';
        th.dataset.sortDir = asc ? 'asc' : 'desc';

        rows.sort((a, b) => {
            let aVal = a.children[colIdx]?.textContent.trim() || '';
            let bVal = b.children[colIdx]?.textContent.trim() || '';
            const aNum = DataService.parseNumber(aVal);
            const bNum = DataService.parseNumber(bVal);
            if (aNum !== 0 || bNum !== 0) {
                return asc ? aNum - bNum : bNum - aNum;
            }
            return asc ? aVal.localeCompare(bVal, 'vi') : bVal.localeCompare(aVal, 'vi');
        });

        rows.forEach(row => tbody.appendChild(row));
    },

    // ============================================
    // MOBILE
    // ============================================

    setupMobile() {
        const mobileToggle = document.getElementById('mobileToggle');
        const sidebar = document.getElementById('sidebar');

        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    },

    // ============================================
    // HELPERS
    // ============================================

    formatVND(val) {
        if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B ₫';
        if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M ₫';
        if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K ₫';
        return val.toLocaleString('vi-VN') + '₫';
    },

    animateValue(elementId, target, isCurrency) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const duration = 800;
        const start = performance.now();
        const startVal = 0;

        const animate = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
            const current = Math.floor(startVal + (target - startVal) * eased);

            if (isCurrency) {
                el.textContent = this.formatVND(current);
            } else {
                el.textContent = current.toLocaleString('vi-VN');
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    },

    getStatusBadge(status) {
        const s = (status || '').toLowerCase();
        if (s.includes('hoàn thành') || s.includes('done')) return '<span class="status-badge done"><i class="fas fa-check"></i> Hoàn thành</span>';
        if (s.includes('đang') || s.includes('running') || s.includes('chạy')) return '<span class="status-badge active"><i class="fas fa-play"></i> Đang chạy</span>';
        if (s.includes('tạm') || s.includes('pause')) return '<span class="status-badge paused"><i class="fas fa-pause"></i> Tạm dừng</span>';
        return '<span class="status-badge active"><i class="fas fa-play"></i> ' + this.escapeHtml(status || 'N/A') + '</span>';
    },

    getTaskStatusBadge(status) {
        const s = (status || '').toLowerCase().trim();
        if (!s) return '<span class="status-badge" style="opacity:0.4">—</span>';
        if (s.includes('đúng hạn')) return '<span class="status-badge done"><i class="fas fa-check"></i> Đúng hạn</span>';
        if (s.includes('done') || s.includes('hoàn thành')) return '<span class="status-badge done"><i class="fas fa-check"></i> Hoàn thành</span>';
        if (s.includes('progress') || s.includes('đang')) return '<span class="status-badge progress"><i class="fas fa-spinner"></i> Đang làm</span>';
        if (s.includes('overdue') || s.includes('quá hạn')) return '<span class="status-badge overdue"><i class="fas fa-exclamation"></i> Quá hạn</span>';
        if (s.includes('pending') || s.includes('chờ')) return '<span class="status-badge paused"><i class="fas fa-clock"></i> Chờ</span>';
        return '<span class="status-badge">' + this.escapeHtml(status) + '</span>';
    },

    // ============================================
    // REPORTS PAGE
    // ============================================

    renderReports() {
        this.setupReportEvents();
        this.loadEmailConfig();
        this.loadSchedules();
    },

    _reportEventsReady: false,
    setupReportEvents() {
        if (this._reportEventsReady) return;
        this._reportEventsReady = true;

        // Toggle email config panel
        document.getElementById('btnToggleEmailConfig')?.addEventListener('click', () => {
            const panel = document.getElementById('emailConfigPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        // Save email config
        document.getElementById('btnSaveEmailConfig')?.addEventListener('click', () => this.saveEmailConfig());
        document.getElementById('btnTestEmail')?.addEventListener('click', () => this.testEmail());

        // Send now
        document.getElementById('btnSendNow')?.addEventListener('click', () => this.sendReportNow());

        // Schedule form
        document.getElementById('btnAddSchedule')?.addEventListener('click', () => {
            this._editingScheduleId = null;
            const formPanel = document.getElementById('scheduleFormPanel');
            const formTitle = formPanel.querySelector('h4');
            if (formTitle) formTitle.textContent = 'Thêm lịch gửi mới';
            // Reset form fields
            document.getElementById('schedPage').value = 'overview';
            document.getElementById('schedFreq').value = 'weekly';
            document.getElementById('schedDay').value = '1';
            document.getElementById('schedTime').value = '08:00';
            document.getElementById('schedEmails').value = '';
            formPanel.style.display = 'block';
        });
        document.getElementById('btnCancelSchedule')?.addEventListener('click', () => {
            this._editingScheduleId = null;
            const formPanel = document.getElementById('scheduleFormPanel');
            const formTitle = formPanel.querySelector('h4');
            if (formTitle) formTitle.textContent = 'Thêm lịch gửi mới';
            formPanel.style.display = 'none';
        });
        document.getElementById('btnSaveSchedule')?.addEventListener('click', () => this.saveSchedule());

        // Toggle day options based on frequency
        document.getElementById('schedFreq')?.addEventListener('change', (e) => {
            const daySelect = document.getElementById('schedDay');
            daySelect.innerHTML = '';
            if (e.target.value === 'monthly') {
                for (let i = 1; i <= 28; i++) {
                    daySelect.innerHTML += `<option value="${i}">Ngày ${i}</option>`;
                }
            } else {
                const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                days.forEach((d, i) => {
                    daySelect.innerHTML += `<option value="${i}" ${i===1?'selected':''}>${d}</option>`;
                });
            }
        });
    },

    async loadEmailConfig() {
        try {
            const resp = await fetch('/api/email-config');
            const config = await resp.json();
            document.getElementById('rptSmtpHost').value = config.smtp_host || '';
            document.getElementById('rptSmtpPort').value = config.smtp_port || '';
            document.getElementById('rptSmtpUser').value = config.smtp_user || '';
            document.getElementById('rptSmtpPass').value = config.smtp_pass === '***' ? '' : (config.smtp_pass || '');
            document.getElementById('rptSmtpName').value = config.display_name || '';
            if (config.smtp_user) {
                document.getElementById('rptSmtpPass').placeholder = '••• (đã lưu)';
            }
        } catch (e) {
            console.log('Email config not available (server not running?)');
        }
    },

    async saveEmailConfig() {
        const data = {
            smtp_host: document.getElementById('rptSmtpHost').value,
            smtp_port: parseInt(document.getElementById('rptSmtpPort').value) || 587,
            smtp_user: document.getElementById('rptSmtpUser').value,
            smtp_pass: document.getElementById('rptSmtpPass').value || '***',
            display_name: document.getElementById('rptSmtpName').value || 'DigiDash Report',
        };
        try {
            const resp = await fetch('/api/email-config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const result = await resp.json();
            if (result.ok) alert('✅ Đã lưu cấu hình email!');
        } catch (e) {
            alert('❌ Lỗi: Server không phản hồi. Hãy chạy server.py');
        }
    },

    async testEmail() {
        try {
            const resp = await fetch('/api/test-email', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: '{}'
            });
            const result = await resp.json();
            alert(result.ok ? '✅ Đã gửi email test!' : '❌ Lỗi: ' + result.message);
        } catch (e) {
            alert('❌ Server không phản hồi');
        }
    },

    async sendReportNow() {
        const page = document.getElementById('rptSendPage').value;
        const emails = document.getElementById('rptSendEmails').value;
        const status = document.getElementById('rptSendStatus');

        if (!emails.trim()) {
            status.textContent = '⚠️ Nhập email nhận';
            status.className = 'rpt-send-status error';
            return;
        }

        status.textContent = '⏳ Đang gửi...';
        status.className = 'rpt-send-status';

        try {
            const resp = await fetch('/api/send-now', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ page, emails })
            });
            const result = await resp.json();
            if (result.ok) {
                status.textContent = '✅ Đã gửi thành công!';
                status.className = 'rpt-send-status success';
            } else {
                status.textContent = '❌ ' + (result.error || result.message);
                status.className = 'rpt-send-status error';
            }
        } catch (e) {
            status.textContent = '❌ Server không phản hồi';
            status.className = 'rpt-send-status error';
        }
    },

    async loadSchedules() {
        try {
            const resp = await fetch('/api/schedules');
            const schedules = await resp.json();
            this.renderScheduleTable(schedules);
        } catch (e) {
            // Server not running
        }
    },

    renderScheduleTable(schedules) {
        const tbody = document.getElementById('scheduleTableBody');
        if (!schedules || schedules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="rpt-empty">Chưa có lịch gửi. Nhấn "Thêm lịch" để tạo.</td></tr>';
            return;
        }

        const pageNames = {
            overview: 'Tổng quan', facebook: 'FB Chuyển đổi', fbmessage: 'FB Tin nhắn',
            google: 'Google Ads', tiktok: 'TikTok Ads', kpi: 'KPIs Nhân sự',
            content: 'Content Plan', tasks: 'Task Management'
        };
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

        tbody.innerHTML = schedules.map(s => {
            const freqLabel = s.frequency === 'monthly' ? 'Hàng tháng' : 'Hàng tuần';
            const dayLabel = s.frequency === 'monthly' ? `Ngày ${s.day}` : (dayNames[s.day] || s.day);
            const statusBadge = s.enabled
                ? '<span class="rpt-badge active">Hoạt động</span>'
                : '<span class="rpt-badge paused">Tạm dừng</span>';
            const lastInfo = s.last_sent ? `<br><small style="color:#94a3b8">Gửi lần cuối: ${new Date(s.last_sent).toLocaleString('vi-VN')}</small>` : '';

            return `<tr>
                <td><strong>${pageNames[s.page] || s.page}</strong>${lastInfo}</td>
                <td>${freqLabel}</td>
                <td>${dayLabel} lúc ${s.time}</td>
                <td>${this.escapeHtml(s.emails)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="rpt-actions">
                        <button onclick="App.editSchedule(${s.id})" title="Chỉnh sửa">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button onclick="App.toggleSchedule(${s.id})" title="${s.enabled ? 'Tạm dừng' : 'Kích hoạt'}">
                            <i class="fas fa-${s.enabled ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="delete" onclick="App.deleteSchedule(${s.id})" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    },

    _editingScheduleId: null,

    async editSchedule(id) {
        try {
            const resp = await fetch('/api/schedules');
            const schedules = await resp.json();
            const sched = schedules.find(s => s.id === id);
            if (!sched) return;

            // Pre-fill form
            document.getElementById('schedPage').value = sched.page || 'overview';
            document.getElementById('schedFreq').value = sched.frequency || 'weekly';
            document.getElementById('schedDay').value = sched.day || '1';
            document.getElementById('schedTime').value = sched.time || '08:00';
            document.getElementById('schedEmails').value = sched.emails || '';

            // Mark as editing
            this._editingScheduleId = id;

            // Update form title
            const formPanel = document.getElementById('scheduleFormPanel');
            const formTitle = formPanel.querySelector('h4');
            if (formTitle) formTitle.textContent = 'Chỉnh sửa lịch gửi';

            // Show form
            formPanel.style.display = 'block';

            // Trigger frequency change for day options
            if (typeof this.onSchedFreqChange === 'function') {
                this.onSchedFreqChange();
            }
        } catch (e) {
            console.error('Edit schedule error:', e);
        }
    },

    async saveSchedule() {
        const data = {
            page: document.getElementById('schedPage').value,
            frequency: document.getElementById('schedFreq').value,
            day: document.getElementById('schedDay').value,
            time: document.getElementById('schedTime').value,
            emails: document.getElementById('schedEmails').value,
        };

        if (!data.emails.trim()) {
            alert('Nhập email nhận');
            return;
        }

        try {
            let resp;
            if (this._editingScheduleId) {
                // Update existing schedule
                resp = await fetch(`/api/schedules/${this._editingScheduleId}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
            } else {
                // Create new schedule
                resp = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
            }
            const result = await resp.json();
            if (result.ok) {
                this._editingScheduleId = null;
                document.getElementById('scheduleFormPanel').style.display = 'none';
                // Reset title
                const formTitle = document.getElementById('scheduleFormPanel').querySelector('h4');
                if (formTitle) formTitle.textContent = 'Thêm lịch gửi mới';
                this.loadSchedules();
            }
        } catch (e) {
            alert('Server không phản hồi');
        }
    },

    async toggleSchedule(id) {
        try {
            const resp = await fetch('/api/schedules');
            const schedules = await resp.json();
            const sched = schedules.find(s => s.id === id);
            if (sched) {
                await fetch(`/api/schedules/${id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ enabled: !sched.enabled })
                });
                this.loadSchedules();
            }
        } catch (e) {}
    },

    async deleteSchedule(id) {
        if (!confirm('Xóa lịch gửi này?')) return;
        try {
            await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
            this.loadSchedules();
        } catch (e) {}
    },

    // ============================================
    // DRAG TO SCROLL
    // ============================================
    setupDragScroll() {
        const el = document.querySelector('.main-content');
        if (!el) return;

        let isDragging = false;
        let startY = 0;
        let scrollStart = 0;
        let velocity = 0;
        let prevY = 0;
        let prevTime = 0;
        let rafId = null;
        let targetScroll = 0;
        const MULTIPLIER = 2;
        const FRICTION = 0.93;
        const MIN_VEL = 0.3;

        const excludeTags = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'CANVAS', 'OPTION']);

        const glide = () => {
            velocity *= FRICTION;
            if (Math.abs(velocity) < MIN_VEL) { rafId = null; return; }
            window.scrollBy(0, -velocity);
            rafId = requestAnimationFrame(glide);
        };

        const stopGlide = () => {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        };

        el.addEventListener('mousedown', (e) => {
            if (excludeTags.has(e.target.tagName)) return;
            if (e.target.closest('button, a, select, input, textarea, canvas, .filter-popover')) return;
            if (e.button !== 0) return;

            stopGlide();
            isDragging = true;
            startY = e.clientY;
            prevY = e.clientY;
            scrollStart = window.scrollY;
            velocity = 0;
            prevTime = performance.now();
            el.style.cursor = 'grabbing';
            el.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const now = performance.now();
            const dt = now - prevTime || 1;
            const dy = e.clientY - prevY;

            // Track velocity (smoothed)
            velocity = velocity * 0.3 + (dy * MULTIPLIER / dt * 16) * 0.7;
            prevY = e.clientY;
            prevTime = now;

            // Direct scroll
            const totalDy = (e.clientY - startY) * MULTIPLIER;
            window.scrollTo(0, scrollStart - totalDy);
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            el.style.cursor = '';
            el.style.userSelect = '';
            if (Math.abs(velocity) > MIN_VEL) {
                rafId = requestAnimationFrame(glide);
            }
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================
// Bootstrap
// ============================================
document.addEventListener('DOMContentLoaded', () => App.init());
