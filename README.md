# AI-Based Smart Library Management & Recommendation System

An intelligent library management ecosystem built using **ReactJS** for the frontend, **Django REST Framework** for the backend, **MySQL** for relational data persistence, and **Machine Learning** algorithms to deliver personalized book recommendations.

## 🚀 Key Features

* **Smart Recommendation Engine:** Machine learning-powered suggestions tailored to user preferences and reading histories.
* **Comprehensive Library Management:** Streamlined handling of book catalogs, inventory tracking, and issuing/return histories.
* **Role-Based Access Control:** Separate workflows and dashboards optimized for library administrators and standard borrowers.
* **Modern Interface:** Responsive, fluid user experience engineered with ReactJS.
* **Robust Backend REST API:** Modular backend powered by Django to ensure seamless data operations and logic decoupling.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | ReactJS, HTML5, CSS3, JavaScript |
| **Backend** | Django REST Framework (Python) |
| **Database** | MySQL |
| **AI/ML Engine** | Python Machine Learning Stack (Scikit-Learn / Pandas) |

---

## 💻 Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js (v18+)
* MySQL Server

### 1. Repository Initialization
Clone the codebase to your local environment:
```bash
git clone https://github.com/Lulieeliyas/AI-Based-Smart-LMS.git
cd AI-Based-Smart-LMS
```

### 2. Backend Setup
1. Navigate into the backend subdirectory:
   ```bash
   cd backend
   ```
2. Spin up a distinct virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Populate your application variables:
   ```bash
   cp .env.example .env
   ```
   *(Open `.env` and supply your database credentials, Django Secret Key, and server configurations).*
4. Apply package requirements:
   ```bash
   pip install -r requirements.txt
   ```
5. Execute internal database schemas:
   ```bash
   python manage.py migrate
   ```
6. Boot up the Django server instance:
   ```bash
   python manage.py runserver 8010
   ```

### 3. Frontend Setup
1. Change workspace context to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Initialize project dependencies:
   ```bash
   npm install
   ```
3. Initialize the development environment:
   ```bash
   npm run dev
   ```

---

## 📂 Repository Breakdown

```text
├── backend/               # Django framework application logic & ML scripts
│   ├── apps/              # Distinct Django modular apps
│   ├── config/            # Core settings and routing configurations
│   ├── manage.py          # Django execution utility
│   └── requirements.txt   # Backend dependency declarations
├── frontend/              # ReactJS single page architecture
├── docker/                # Deployment and container orchestration files
└── scripts/               # Automation and maintenance files
```

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create.
1. Fork the Repository.
2. Form your Feature Branch (`git checkout -b feature/SmartFeature`).
3. Commit structural updates (`git commit -m 'Add specialized smart layer'`).
4. Push safely to the Origin Branch (`git push origin feature/SmartFeature`).
5. Construct a documented Pull Request.

