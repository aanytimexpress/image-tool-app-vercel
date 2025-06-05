import React, { useState, useEffect } from 'react';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// --- WARNING: TEMPORARY HARDCODING FOR DEBUGGING PURPOSES ONLY ---
// DO NOT USE HARDCODED API KEYS OR FIREBASE CONFIG IN PRODUCTION
// This is done to bypass environment variable parsing issues and diagnose Firebase initialization.

const HARDCODED_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAv3w8ERktKMu6UB3mDctWoPkhoqTPfVhc",
    authDomain: "myimagetoolapp.firebaseapp.com",
    projectId: "myimagetoolapp",
    storageBucket: "myimagetoolapp.firebasestorage.app",
    messagingSenderId: "13925896046",
    appId: "1:13925896046:web:e31386f3dff78a6b487b7f",
    measurementId: "G-49SP3ZTB79"
};

// IMPORTANT: Replace "AIzaSyBlTC2lpojtjjr05JL8sptar__hDeaS_B4" with your actual Gemini API Key
const HARDCODED_GEMINI_API_KEY = "AIzaSyBlTC2lpojtjjr05JL8sptar__hDeaS_B4"; // <-- Ekhane tomar asli Gemini API Key paste koro

const app = initializeApp(HARDCODED_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

// Logging for debugging purposes - These lines will show info in the console after deploying to Vercel
console.log("DEBUG: Initial Firebase Config (Hardcoded) ->", HARDCODED_FIREBASE_CONFIG);
console.log("DEBUG: Firebase App Instance ->", app); // Should not be null if config is valid
console.log("DEBUG: Firebase Auth Instance ->", auth); // Should not be null if app is valid
console.log("DEBUG: Firebase Firestore Instance ->", db); // Should not be null if app is valid
console.log("DEBUG: Gemini API Key (Hardcoded) ->", HARDCODED_GEMINI_API_KEY);

// Default values for app ID and auth token, as they are not critical for this specific debug
const getAppId = () => 'default-app-id-hardcoded';
const getAuthToken = () => null;

// --- END TEMPORARY HARDCODING ---


function App() {
    const [image, setImage] = useState(null);
    const [title, setTitle] = useState('');
    const [keywords, setKeywords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [userId, setUserId] = useState(null); // userId will be set after auth is ready
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        if (!auth) {
            console.error("Firebase Auth instance is not available. This should not happen with hardcoded config.");
            setError("Application initialization failed. Firebase Auth is not available.");
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { // If no user is logged in
                try {
                    const token = getAuthToken(); // This will be null for hardcoded path
                    if (token) {
                        await signInWithCustomToken(auth, token);
                    } else {
                        await signInAnonymously(auth); // Sign in anonymously
                    }
                } catch (err) {
                    console.error("Firebase authentication error during sign-in:", err);
                    setError("Firebase authentication failed. Please check network and Firebase rules (Anonymous sign-in).");
                }
            }
            setUserId(auth.currentUser?.uid || crypto.randomUUID());
            setIsAuthReady(true);
        });

        return () => unsubscribe();
    }, [auth]);


    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please upload image files only.');
                setImage(null);
                setPreviewUrl(null);
                return;
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('Image size cannot exceed 5MB.');
                setImage(null);
                setPreviewUrl(null);
                return;
            }

            setError('');
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result);
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setImage(null);
            setPreviewUrl(null);
        }
    };

    const handleGenerate = async () => {
        if (!image) {
            setError('Please upload an image.');
            return;
        }
        if (!isAuthReady || !userId || !db) {
            setError('Application is preparing, please wait a moment.');
            console.warn("Firestore not ready or userId not set. isAuthReady:", isAuthReady, "userId:", userId, "db:", db);
            return;
        }

        setLoading(true);
        setError('');
        setTitle('');
        setKeywords([]);

        const imageMimeType = image.substring(image.indexOf(':') + 1, image.indexOf(';'));
        const base64ImageData = image.split(',')[1];

        const prompt = `Based on this image, generate a trendy, appealing title following general Adobe Stock guidelines (e.g., descriptive, unique, marketable). Also, provide approximately 45 single-word keywords highly relevant to the image content. Ensure keywords are distinct and represent key elements, concepts, and styles present in the image. Use only single words.`;

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: imageMimeType,
                                data: base64ImageData
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "title": { "type": "STRING" },
                        "keywords": {
                            "type": "ARRAY",
                            "items": { "type": "STRING" }
                        }
                    },
                    "propertyOrdering": ["title", "keywords"]
                }
            }
        };

        const geminiApiKey = HARDCODED_GEMINI_API_KEY; // Use hardcoded API key
        if (!geminiApiKey || geminiApiKey === "AIzaSyBlTC2lpojtjjr05JL8sptar__hDeaS_B4") {
            setError("Gemini API Key is not set or is a placeholder. Please update App.js with your actual key.");
            setLoading(false);
            return;
        }
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const json = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(json);

                setTitle(parsedJson.title || '');
                setKeywords(Array.isArray(parsedJson.keywords) ? parsedJson.keywords : []);

                const appId = getAppId();
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/generated_data`, `data_${Date.now()}`);
                await setDoc(userDocRef, {
                    timestamp: new Date(),
                    imageMimeType: imageMimeType,
                    title: parsedJson.title || '',
                    keywords: Array.isArray(parsedJson.keywords) ? parsedJson.keywords : [],
                    userId: userId
                });

            } else {
                setError('Generation failed. Unexpected API response. Please try again.');
                console.error("Unexpected API response structure:", result);
            }
        } catch (err) {
            setError('An error occurred during generation: ' + err.message);
            console.error("API call error:", err);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text, type) => {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = text;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        try {
            document.execCommand('copy');
            const messageBox = document.createElement('div');
            messageBox.textContent = `${type} copied!`;
            messageBox.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.5s ease-in-out;
            `;
            document.body.appendChild(messageBox);
            setTimeout(() => {
                messageBox.style.opacity = '1';
            }, 10);
            setTimeout(() => {
                messageBox.style.opacity = '0';
                messageBox.addEventListener('transitionend', () => messageBox.remove());
            }, 2000);

        } catch (err) {
            console.error('Failed to copy:', err);
            const messageBox = document.createElement('div');
            messageBox.textContent = 'Failed to copy.';
            messageBox.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #f44336;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.5s ease-in-out;
            `;
            document.body.appendChild(messageBox);
            setTimeout(() => {
                messageBox.style.opacity = '1';
            }, 10);
            setTimeout(() => {
                messageBox.style.opacity = '0';
                messageBox.addEventListener('transitionend', () => messageBox.remove());
            }, 2000);
        }
        document.body.removeChild(tempTextArea);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-inter text-gray-100 flex items-center justify-center p-4">
            {/* Welcome Message Section */}
            <div className="mb-8 w-full max-w-4xl text-center flex flex-col items-center">
                <img
                    src="https://i.imgur.com/Koo6due.jpeg"
                    alt="SHAHADAT HOSSAIN BAPPI's Photo"
                    className="w-32 h-32 rounded-full border-4 border-purple-400 shadow-lg mb-4"
                />
                <h1 className="text-4xl font-bold text-white drop-shadow-lg animate-fade-in-down">
                    SHAHADAT HOSSAIN
                </h1>
                <p className="text-2xl text-purple-200 mt-1 font-semibold animate-fade-in-up">
                    Senior Graphic Designer
                </p>
                <p className="text-xl text-gray-200 mt-1 animate-fade-in-up">
                    at DesignXpress
                </p>
                <p className="text-lg text-gray-300 mt-4 animate-fade-in-up">
                    Welcome to my AI Powered Image Tool!
                </p>
            </div>

            <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg border border-opacity-20 border-white rounded-xl shadow-2xl p-8 max-w-4xl w-full flex flex-col md:flex-row gap-8">
                {/* Left Panel: Image Upload & Preview */}
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <h2 className="text-3xl font-bold mb-6 text-white text-center">Image Title & Keyword Generator</h2>
                    <div className="w-full h-64 border-2 border-dashed border-gray-300 border-opacity-50 rounded-lg flex items-center justify-center relative overflow-hidden bg-gray-700 bg-opacity-30 mb-6">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                        ) : (
                            <span className="text-gray-300 text-lg">Upload Image Here</span>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                    <button
                        onClick={handleGenerate}
                        className="w-full bg-gradient-to-r from-teal-400 to-blue-500 hover:from-teal-500 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 mb-4"
                        disabled={loading || !image}
                    >
                        {loading ? 'Generating...' : 'Generate Title & Keywords'}
                    </button>
                    {error && (
                        <p className="text-red-300 text-sm mt-2 text-center">{error}</p>
                    )}
                    {userId && (
                        <p className="text-gray-300 text-xs mt-4 break-all">User ID: {userId}</p>
                    )}
                </div>

                {/* Right Panel: Output */}
                <div className="flex-1 flex flex-col p-4">
                    <h3 className="text-2xl font-bold mb-4 text-white">Generated Results</h3>

                    {/* Title Output */}
                    <div className="mb-6">
                        <label className="block text-gray-300 text-sm font-bold mb-2">Title:</label>
                        <div className="relative">
                            <textarea
                                readOnly
                                value={title}
                                className="w-full p-3 pr-12 rounded-lg bg-gray-800 bg-opacity-50 border border-gray-600 text-white focus:outline-none focus:border-purple-400 resize-none h-24 scrollbar-thin scrollbar-thumb-purple-400 scrollbar-track-gray-700"
                                placeholder="Generated title will appear here..."
                            ></textarea>
                            {title && (
                                <button
                                    onClick={() => copyToClipboard(title, 'Title')}
                                    className="absolute top-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition-colors duration-200"
                                    aria-label="Copy Title"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v2M8 5h2v2h-2V5z"></path>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Keywords Output */}
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">Keywords (Total {keywords.length}):</label>
                        <div className="relative">
                            <div className="w-full min-h-[100px] p-3 pr-12 rounded-lg bg-gray-800 bg-opacity-50 border border-gray-600 text-white focus:outline-none focus:border-purple-400 flex flex-wrap gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-400 scrollbar-track-gray-700 max-h-48">
                                {keywords.length > 0 ? (
                                    keywords.map((kw, index) => (
                                        <span key={index} className="bg-blue-600 bg-opacity-70 text-white text-xs px-3 py-1 rounded-full shadow-md">
                                            {kw}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-gray-400">Generated keywords will appear here...</span>
                                )}
                            </div>
                            {keywords.length > 0 && (
                                <button
                                    onClick={() => copyToClipboard(keywords.join(', '), 'Keywords')}
                                    className="absolute top-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition-colors duration-200"
                                    aria-label="Copy Keywords"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v2M8 5h2v2h-2V5z"></path>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
