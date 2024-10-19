// src/App.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  // Definicja stanów
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [practiceAll, setPracticeAll] = useState(false);
  const [activeTab, setActiveTab] = useState('learn'); // Stan dla aktywnej zakładki

  // Pobieranie kategorii i fiszek przy zmianie zależności
  useEffect(() => {
    fetchCategories();
    if (activeTab === 'learn') {
      fetchFlashcards();
    }
  }, [practiceAll, selectedCategory, activeTab]);

  // Funkcja pobierająca kategorie
  const fetchCategories = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Funkcja pobierająca fiszki
  const fetchFlashcards = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/flashcards', {
        params: {
          all: practiceAll,
          category: selectedCategory
        }
      });
      setFlashcards(response.data);
      setCurrentIndex(0);
      setShowTranslation(false);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
    }
  };

  // Funkcja do wyświetlania tłumaczenia
  const handleShowTranslation = () => {
    setShowTranslation(true);
  };

  // Funkcja obsługująca przejście do następnej fiszki
  const handleNextCard = (quality) => {
    if (flashcards.length > 0) {
      const currentFlashcard = flashcards[currentIndex];
      axios.post(`http://localhost:5001/api/flashcards/${currentFlashcard._id}/review`, { quality })
        .then(response => {
          const updatedFlashcards = flashcards.filter((_, index) => index !== currentIndex);
          setFlashcards(updatedFlashcards);
          setCurrentIndex((prevIndex) => (updatedFlashcards.length === 0 ? 0 : prevIndex % updatedFlashcards.length));
          setShowTranslation(false);
        })
        .catch(error => {
          console.error("Error updating flashcard:", error);
        });
    }
  };

  // Funkcja do masowego dodawania fiszek
  const handleBulkAdd = async () => {
    if (!bulkInput || !selectedCategory) {
      alert("Wprowadź dane i wybierz kategorię.");
      return;
    }

    try {
      await axios.post('http://localhost:5001/api/flashcards/bulk_add', {
        data: bulkInput,
        category: selectedCategory,
      });
      alert('Słówka zostały dodane pomyślnie');
      setBulkInput('');
      fetchCategories();
    } catch (error) {
      console.error('Błąd podczas dodawania słówek:', error);
      alert('Wystąpił błąd podczas dodawania słówek');
    }
  };

  // Funkcja obsługująca zmianę kategorii
  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  // Funkcja obsługująca zmianę zakładki
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Górne menu nawigacyjne */}
      <nav className="bg-white shadow">
        <ul className="flex">
          <li
            className={`flex-1 text-center py-4 cursor-pointer border-b-2 ${
              activeTab === 'learn' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-600'
            }`}
            onClick={() => handleTabChange('learn')}
          >
            <span className="text-lg font-semibold">Ucz się</span>
          </li>
          <li
            className={`flex-1 text-center py-4 cursor-pointer border-b-2 ${
              activeTab === 'add' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-600'
            }`}
            onClick={() => handleTabChange('add')}
          >
            <span className="text-lg font-semibold">Dodaj słówka</span>
          </li>
        </ul>
      </nav>

      {/* Główna treść */}
      <div className="flex-1 p-6">
        {activeTab === 'learn' && (
          <>
            <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">English-Polish Flashcards</h1>

            {/* Wybór kategorii */}
            <div className="mb-6 flex flex-col sm:flex-row items-center justify-center">
              <div className="flex items-center mb-4 sm:mb-0">
                <label className="mr-2 text-lg font-medium text-gray-700">Wybierz kategorię:</label>
                <select
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  className="border border-gray-300 rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wszystkie</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setPracticeAll(!practiceAll)}
                className="mt-2 sm:mt-0 sm:ml-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow"
              >
                {practiceAll ? "Powtarzaj zaplanowane słówka" : "Powtarzaj wszystkie słówka"}
              </button>
            </div>

            {/* Wyświetlanie fiszki */}
            {flashcards.length > 0 ? (
              <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-center text-gray-800">{flashcards[currentIndex].english}</h2>

                {showTranslation && (
                  <p className="text-xl text-center text-gray-600 mt-4">{flashcards[currentIndex].polish}</p>
                )}

                {!showTranslation && (
                  <button
                    onClick={handleShowTranslation}
                    className="mt-6 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full shadow"
                  >
                    Pokaż tłumaczenie
                  </button>
                )}

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => handleNextCard(5)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-l-full shadow"
                  >
                    Znam
                  </button>
                  <button
                    onClick={() => handleNextCard(2)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-r-full shadow"
                  >
                    Nie znam
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-700">Nie ma fiszek do powtórzenia.</p>
            )}
          </>
        )}

        {activeTab === 'add' && (
          <>
            <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Dodaj słówka</h1>

            {/* Masowe dodawanie fiszek */}
            <div className="max-w-xl mx-auto bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Dodaj wiele słówek</h2>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Wpisz słówka w formacie: angielskie; polskie"
                rows={10}
                className="w-full border border-gray-300 rounded p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-4">
                <label className="mr-2 text-lg font-medium text-gray-700">Wybierz kategorię:</label>
                <select
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  className="border border-gray-300 rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wybierz kategorię</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleBulkAdd}
                className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded shadow"
              >
                Dodaj słówka
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
