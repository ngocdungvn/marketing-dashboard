// ============================================
// DigiDash - Configuration
// Google Sheet CSV URLs (Direct from Drive)
// ============================================

const CONFIG = {
    // Google Sheet IDs from user's Drive folder
    sheets: {
        planning:     '1_-7f6qsw4BfXkUkZg92VvIIUx87kDRkvsEGK7n4s-oA',  // 0.1 Hoạch định mục tiêu
        budget:       '1QYGfCiETaLd0J1Ab9HYBrMK9syawSKNL50_G-XnVzRs',  // 0.2 Kế hoạch ngân sách
        performance:  '1MGVtHY3E85b27TybFvjFX_eXLssbLFxeQ2h8XdJnOuM',  // 1. Hiệu suất & Ngân sách
        fbConversion: '1r5pJNWK5wECSHSNokU6LyBYmu4SxXauh9wjGwVml2XM',  // 2. FB Ads Chuyển đổi
        fbMessage:    '17ZLBmaWH-TQPqv3CooheS3Pl1kT8Tdn3aPf2HUphZZA',  // 3. FB Ads Tin nhắn
        googleAds:    '1wK96-LzkyO0AJ9TqDYbH2i1CNsBHWwfQ0QJXmXUEQm8',  // 4. Google Ads
        tiktokAds:    '1GzL3Ei6VVVQjfL7TR_rAGD_1CablE1MbQxmnhtEjmtg',  // 5. TikTok Ads
        kpi:          '1iPv8BnkrdpTQ-DU0XSdTljmMhRTRcHUqjPdYye679jk',  // 6. KPIs Nhân sự
        contentPlan:  '1b47jW6xkUutKbl8h_U-kZFXhjVOzzBciiKcDVhFzLjQ',  // 7. Content Plan
        tasks:        '1UQE4kdUQTaxm9ZGR8G5Qw6lgQb-kEz5FfB8meSoCvcw',  // 8. Task Management
    },

    // Preferred tab names in each sheet (in order of priority)
    // Will try each until one is found
    tabNames: {
        performance:  ['Input', 'data', 'Data', 'Sheet1'],
        fbConversion: ['Input', 'data', 'Data', 'Sheet1'],
        fbMessage:    ['Input', 'data', 'Data', 'Sheet1'],
        googleAds:    ['Input', 'data', 'Data', 'Sheet1'],
        tiktokAds:    ['Input', 'data', 'Data', 'Sheet1'],
        kpi:          ['Input', 'data', 'Data', 'Sheet1'],
        contentPlan:  ['Input', 'data', 'Data', 'Sheet1'],
        tasks:        ['Input', 'data', 'Data', 'Sheet1'],
    },

    // Custom published CSV URLs (override - user can paste from Settings)
    urls: {
        performance: '',
        fbConversion: '',
        fbMessage: '',
        googleAds: '',
        tiktokAds: '',
        kpi: '',
        contentPlan: '',
        tasks: '',
    },

    storageKey: 'digidash_urls',

    /**
     * Build CSV export URL from Sheet ID and tab name
     * Uses the gviz/tq endpoint which works when sheet is shared
     */
    buildCsvUrl(sheetId, sheetName) {
        return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    },

    /**
     * Get CSV URL for a given data key.
     * Priority: 1) Custom URL from Settings, 2) Auto-generated from Sheet ID
     */
    getCsvUrl(key) {
        // Check custom URL first
        if (this.urls[key] && this.urls[key].trim()) {
            return this.urls[key].trim();
        }
        // Build from Sheet ID
        const sheetId = this.sheets[key];
        if (!sheetId) return null;
        // Return first tab name as default
        const tabs = this.tabNames[key] || ['data'];
        return this.buildCsvUrl(sheetId, tabs[0]);
    },

    /**
     * Auto-convert any Google Sheet URL to proper CSV endpoints
     * Handles: /edit, /copy, /pub, direct drive links, and already correct gviz URLs
     */
    normalizeSheetUrl(url) {
        if (!url || !url.trim()) return [];
        url = url.trim();
        
        // Already a gviz/tq CSV URL → use as is
        if (url.includes('gviz/tq')) return [url];
        
        // Already a pub?output=csv URL → use as is
        if (url.includes('pub?') && url.includes('output=csv')) return [url];
        
        // Extract Sheet ID from various Google Sheet URL formats
        const patterns = [
            /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,  // /spreadsheets/d/SHEET_ID/...
            /^([a-zA-Z0-9_-]{30,})$/,                // Just a Sheet ID pasted directly
        ];
        
        let sheetId = null;
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                sheetId = match[1];
                break;
            }
        }
        
        if (!sheetId) return [url]; // Unknown format, try as-is
        
        // Build gviz URLs with multiple tab names
        const tabNames = ['Input', 'data', 'Data', 'Sheet1'];
        return tabNames.map(tab => this.buildCsvUrl(sheetId, tab));
    },

    /**
     * Get all possible URLs for a key (tries multiple tab names)
     */
    getCsvUrls(key) {
        if (this.urls[key] && this.urls[key].trim()) {
            return this.normalizeSheetUrl(this.urls[key]);
        }
        const sheetId = this.sheets[key];
        if (!sheetId) return [];
        const tabs = this.tabNames[key] || ['data'];
        return tabs.map(tab => this.buildCsvUrl(sheetId, tab));
    },

    loadUrls() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                Object.assign(this.urls, parsed);
            } catch (e) {
                console.warn('Failed to load saved URLs');
            }
        }
    },

    saveUrls() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.urls));
    },

    hasUrls() {
        return Object.values(this.urls).some(url => url && url.trim() !== '') ||
               Object.values(this.sheets).some(id => id && id.trim() !== '');
    }
};

// ============================================
// Demo Data - Fallback khi không kết nối được Sheet
// ============================================
const DEMO_DATA = {
    performance: [
        { kenh: 'Facebook Ads', thang: 'Tháng 1', loaiChienDich: 'Conversion', tenChienDich: 'Tết Nguyên Đán', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 450, kpiName2: 'ROAS', kpiValue2: 3.2, nganSachDuKien: 50000000, soTienDaChi: 48500000, trangThai: 'Hoàn thành' },
        { kenh: 'Facebook Ads', thang: 'Tháng 2', loaiChienDich: 'Message', tenChienDich: 'Valentine Sale', mucTieu: 'Tin nhắn', kpiName1: 'Tin nhắn', kpiValue1: 1200, kpiName2: 'CPC', kpiValue2: 2500, nganSachDuKien: 35000000, soTienDaChi: 33200000, trangThai: 'Hoàn thành' },
        { kenh: 'Facebook Ads', thang: 'Tháng 3', loaiChienDich: 'Conversion', tenChienDich: '8/3 Phụ nữ', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 380, kpiName2: 'ROAS', kpiValue2: 2.8, nganSachDuKien: 45000000, soTienDaChi: 42100000, trangThai: 'Hoàn thành' },
        { kenh: 'Facebook Ads', thang: 'Tháng 4', loaiChienDich: 'Conversion', tenChienDich: 'Flash Sale Hè', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 520, kpiName2: 'ROAS', kpiValue2: 3.5, nganSachDuKien: 55000000, soTienDaChi: 51000000, trangThai: 'Hoàn thành' },
        { kenh: 'Facebook Ads', thang: 'Tháng 5', loaiChienDich: 'Message', tenChienDich: 'Lead Gen Q2', mucTieu: 'Lead', kpiName1: 'Tin nhắn', kpiValue1: 980, kpiName2: 'CPL', kpiValue2: 35000, nganSachDuKien: 40000000, soTienDaChi: 38500000, trangThai: 'Hoàn thành' },
        { kenh: 'Google Ads', thang: 'Tháng 1', loaiChienDich: 'Search', tenChienDich: 'Brand Search', mucTieu: 'Traffic', kpiName1: 'Clicks', kpiValue1: 8500, kpiName2: 'CTR', kpiValue2: 4.5, nganSachDuKien: 30000000, soTienDaChi: 28900000, trangThai: 'Hoàn thành' },
        { kenh: 'Google Ads', thang: 'Tháng 2', loaiChienDich: 'Shopping', tenChienDich: 'Product Listing', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 320, kpiName2: 'ROAS', kpiValue2: 4.1, nganSachDuKien: 35000000, soTienDaChi: 34200000, trangThai: 'Hoàn thành' },
        { kenh: 'Google Ads', thang: 'Tháng 3', loaiChienDich: 'Search', tenChienDich: 'Generic Keywords', mucTieu: 'Traffic', kpiName1: 'Clicks', kpiValue1: 12000, kpiName2: 'CTR', kpiValue2: 3.8, nganSachDuKien: 40000000, soTienDaChi: 39100000, trangThai: 'Hoàn thành' },
        { kenh: 'Google Ads', thang: 'Tháng 4', loaiChienDich: 'PMax', tenChienDich: 'Performance Max', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 410, kpiName2: 'ROAS', kpiValue2: 3.9, nganSachDuKien: 45000000, soTienDaChi: 43500000, trangThai: 'Đang chạy' },
        { kenh: 'Google Ads', thang: 'Tháng 5', loaiChienDich: 'Search', tenChienDich: 'Remarketing', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 280, kpiName2: 'ROAS', kpiValue2: 5.2, nganSachDuKien: 25000000, soTienDaChi: 22800000, trangThai: 'Đang chạy' },
        { kenh: 'TikTok Ads', thang: 'Tháng 1', loaiChienDich: 'In-feed', tenChienDich: 'Viral Challenge', mucTieu: 'Awareness', kpiName1: 'Views', kpiValue1: 500000, kpiName2: 'CPV', kpiValue2: 50, nganSachDuKien: 20000000, soTienDaChi: 19500000, trangThai: 'Hoàn thành' },
        { kenh: 'TikTok Ads', thang: 'Tháng 2', loaiChienDich: 'Spark', tenChienDich: 'UGC Boost', mucTieu: 'Engagement', kpiName1: 'Interactions', kpiValue1: 85000, kpiName2: 'CPE', kpiValue2: 200, nganSachDuKien: 15000000, soTienDaChi: 14200000, trangThai: 'Hoàn thành' },
        { kenh: 'TikTok Ads', thang: 'Tháng 3', loaiChienDich: 'Shopping', tenChienDich: 'TikTok Shop', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 180, kpiName2: 'ROAS', kpiValue2: 2.1, nganSachDuKien: 25000000, soTienDaChi: 23800000, trangThai: 'Hoàn thành' },
        { kenh: 'TikTok Ads', thang: 'Tháng 4', loaiChienDich: 'In-feed', tenChienDich: 'Summer Collection', mucTieu: 'Doanh số', kpiName1: 'Đơn hàng', kpiValue1: 220, kpiName2: 'ROAS', kpiValue2: 2.5, nganSachDuKien: 30000000, soTienDaChi: 28500000, trangThai: 'Đang chạy' },
        { kenh: 'TikTok Ads', thang: 'Tháng 5', loaiChienDich: 'Spark', tenChienDich: 'KOL Collab', mucTieu: 'Awareness', kpiName1: 'Views', kpiValue1: 750000, kpiName2: 'CPV', kpiValue2: 40, nganSachDuKien: 35000000, soTienDaChi: 31000000, trangThai: 'Đang chạy' },
    ],

    fbAds: [
        { ngay: '01/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Conversion', tenChienDich: 'Tết Nguyên Đán', chiTieu: 1800000, clicks: 450, hienThi: 25000, donHang: 18, doanhSo: 5400000 },
        { ngay: '02/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Conversion', tenChienDich: 'Tết Nguyên Đán', chiTieu: 2100000, clicks: 520, hienThi: 28000, donHang: 22, doanhSo: 6600000 },
        { ngay: '03/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Message', tenChienDich: 'Lead Gen Tết', chiTieu: 1500000, clicks: 380, hienThi: 22000, donHang: 0, doanhSo: 0 },
        { ngay: '05/01/2024', tenTaiKhoan: 'TK2', loaiChienDich: 'Conversion', tenChienDich: 'Xả hàng tồn kho', chiTieu: 950000, clicks: 280, hienThi: 18000, donHang: 12, doanhSo: 3600000 },
        { ngay: '10/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Conversion', tenChienDich: 'Flash Sale', chiTieu: 3200000, clicks: 890, hienThi: 45000, donHang: 35, doanhSo: 10500000 },
    ],

    googleAds: [
        { ngay: '01/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Search', tenChienDich: 'Đón xuân giáp thìn', chiTieu: 1200000, clicks: 350, hienThi: 8500 },
        { ngay: '02/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Shopping', tenChienDich: 'Product Feed Q1', chiTieu: 1800000, clicks: 420, hienThi: 12000 },
        { ngay: '05/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Search', tenChienDich: 'Brand Keywords', chiTieu: 800000, clicks: 620, hienThi: 5800 },
        { ngay: '10/01/2024', tenTaiKhoan: 'TK2', loaiChienDich: 'PMax', tenChienDich: 'Performance Max', chiTieu: 2500000, clicks: 780, hienThi: 35000 },
    ],

    tiktokAds: [
        { ngay: '01/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'In-feed', tenChienDich: 'Viral Tết', chiTieu: 900000, clicks: 280, hienThi: 85000, donHang: 8, doanhSo: 2400000 },
        { ngay: '05/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Spark', tenChienDich: 'KOL Review', chiTieu: 1500000, clicks: 450, hienThi: 120000, donHang: 15, doanhSo: 4500000 },
        { ngay: '10/01/2024', tenTaiKhoan: 'TK1', loaiChienDich: 'Shopping', tenChienDich: 'TikTok Shop', chiTieu: 2000000, clicks: 620, hienThi: 95000, donHang: 22, doanhSo: 6600000 },
    ],

    kpis: [
        { thang: 'Tháng 1', boPhan: 'Performance', kpi: 'Doanh số đạt target', mucTieu: '500,000,000₫', trongSo: '30%', ketQua: '85%' },
        { thang: 'Tháng 1', boPhan: 'Performance', kpi: 'ROAS tối thiểu', mucTieu: '3.0x', trongSo: '20%', ketQua: '107%' },
        { thang: 'Tháng 1', boPhan: 'Performance', kpi: 'Số đơn hàng mới', mucTieu: '200', trongSo: '15%', ketQua: '92%' },
        { thang: 'Tháng 1', boPhan: 'Content', kpi: 'Số bài viết/tháng', mucTieu: '30', trongSo: '25%', ketQua: '110%' },
        { thang: 'Tháng 1', boPhan: 'Content', kpi: 'Engagement Rate', mucTieu: '5%', trongSo: '20%', ketQua: '96%' },
        { thang: 'Tháng 1', boPhan: 'SEO', kpi: 'Organic Traffic', mucTieu: '50,000', trongSo: '30%', ketQua: '78%' },
        { thang: 'Tháng 1', boPhan: 'SEO', kpi: 'Top 10 Keywords', mucTieu: '25', trongSo: '25%', ketQua: '88%' },
        { thang: 'Tháng 1', boPhan: 'Design', kpi: 'Thiết kế hoàn thành', mucTieu: '40', trongSo: '30%', ketQua: '95%' },
    ],

    tasks: [
        { trangThai: 'Hoàn thành', ngayGiao: '01/01/2024', nguoiThucHien: 'Nguyễn Văn A', viTri: 'Designer', nhiemVu: 'Hoàn thành thiết kế background Tết', deadline: '05/01/2024', trangThaiXuLy: 'Done' },
        { trangThai: 'Hoàn thành', ngayGiao: '02/01/2024', nguoiThucHien: 'Trần Thị B', viTri: 'Content', nhiemVu: 'Viết content chiến dịch Valentine', deadline: '10/01/2024', trangThaiXuLy: 'Done' },
        { trangThai: 'Đang làm', ngayGiao: '05/01/2024', nguoiThucHien: 'Lê Văn C', viTri: 'SEO', nhiemVu: 'Audit SEO title & metadata', deadline: '15/01/2024', trangThaiXuLy: 'In Progress' },
        { trangThai: 'Đang làm', ngayGiao: '08/01/2024', nguoiThucHien: 'Phạm Thị D', viTri: 'Ads', nhiemVu: 'Setup Facebook Ads tháng 2', deadline: '20/01/2024', trangThaiXuLy: 'In Progress' },
        { trangThai: 'Quá hạn', ngayGiao: '01/01/2024', nguoiThucHien: 'Hoàng Văn E', viTri: 'Video', nhiemVu: 'Quay video TikTok sản phẩm mới', deadline: '10/01/2024', trangThaiXuLy: 'Overdue' },
        { trangThai: 'Chờ', ngayGiao: '10/01/2024', nguoiThucHien: 'Nguyễn Thị F', viTri: 'Content', nhiemVu: 'Lập content plan tháng 2', deadline: '25/01/2024', trangThaiXuLy: 'Pending' },
    ]
};
