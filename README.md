# MacroLift | Local-First Fitness & Nutrition Intelligence System

[![Live Demo](https://img.shields.io/badge/Demo-Live%20App-brightgreen)](https://macrolift-one.vercel.app/)
[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20TypeScript%20%7C%20Tailwind-blue)]()

A high-performance, **Local-First Decision Support System (DSS)** designed for fitness tracking, weekly weight trend analysis, and nutrition management. Built with a zero-cost operational model (Zero OPEX) ensuring 100% user data privacy.

Developed by an **Industrial Engineering & Information Systems** student as a study in process optimization and AI-assisted engineering.

---

## 📌 Problem & Solution
* **The Problem:** Traditional tracking apps suffer from tedious data entry, statistical noise from daily water weight swings, and invasive cloud storage for private progress photos.
* **The Solution:** A lean, client-side PWA that computes rolling weekly averages, performs on-device image processing, and uses a hybrid local/Gemini AI search for instant nutrition logging with zero cloud storage costs.

---

## ⚙️ Key Features & Engineering
* **Local-First Architecture:** 100% of user data and progress photos reside inside the browser's IndexedDB/LocalStorage using Persistent Storage.
* **Hybrid Nutrition Search:** Offline fast database for Israeli fitness staples with Gemini API fallback for dynamic items.
* **Data Portability:** Full JSON backup/restore mechanism and structured CSV export for analytics.
* **Mobile & iOS Ergonomics:** Custom PWA optimizations, Web Audio API rest timer alerts, and safe-area handling.

---

## 🛠️ Tech Stack
* React 18, TypeScript, Vite, Tailwind CSS
* IndexedDB & Web Storage APIs
* Google Gemini API
* Vercel Deployment
