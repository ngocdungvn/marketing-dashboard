# DigiDash - Digital Marketing Dashboard

Dashboard tổng hợp số liệu Digital Marketing từ Google Sheets.  
Hiển thị biểu đồ tương tác, KPI cards và bảng dữ liệu chi tiết.

![Dashboard Preview](https://img.shields.io/badge/Status-Active-brightgreen) ![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white) ![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white) ![JS](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

## ✨ Tính năng

- 📊 **6 trang dashboard**: Tổng quan, Facebook Ads, Google Ads, TikTok Ads, KPIs, Tasks
- 📈 **Biểu đồ tương tác**: Line, Bar, Doughnut charts (Chart.js)
- 🔢 **KPI Cards**: Tổng chi tiêu, doanh số, đơn hàng, ROAS
- 📋 **Bảng dữ liệu**: Sort, tìm kiếm, lọc theo tháng
- 🔗 **Kết nối Google Sheets**: Đọc dữ liệu trực tiếp từ published CSV
- 🌙 **Dark Theme**: Glassmorphism, gradient, micro-animations
- 📱 **Responsive**: Tương thích desktop & mobile

## 🚀 Cách sử dụng

### 1. Mở Dashboard
Mở file `index.html` trực tiếp trên trình duyệt (double-click).

### 2. Kết nối Google Sheet (Tùy chọn)
Dashboard hoạt động với dữ liệu demo. Để kết nối dữ liệu thật:

1. Mở Google Sheet → **File** → **Share** → **Publish to web**
2. Chọn tab `data` → Format: **CSV** → Nhấn **Publish**
3. Copy link CSV được tạo
4. Trên Dashboard, nhấn icon ⚙️ (Settings)
5. Dán link vào ô tương ứng → Nhấn **Lưu & Tải dữ liệu**

### 3. Refresh dữ liệu
Nhấn nút 🔄 trên thanh trên để tải lại dữ liệu mới nhất từ Google Sheets.

## 📁 Cấu trúc

```
├── index.html          # Trang chính
├── css/style.css       # Dark theme styling
├── js/
│   ├── config.js       # Cấu hình URLs + demo data
│   ├── data.js         # Fetch & parse CSV
│   ├── charts.js       # Chart.js configurations
│   └── app.js          # Main application logic
├── .gitignore
└── README.md
```

## 🛠 Công nghệ

- HTML5 + CSS3 + Vanilla JavaScript
- [Chart.js 4.4](https://www.chartjs.org/) - Biểu đồ tương tác
- [Font Awesome 6](https://fontawesome.com/) - Icons
- [Inter Font](https://fonts.google.com/specimen/Inter) - Typography
- Google Sheets CSV API - Nguồn dữ liệu

## 📄 License

MIT License
