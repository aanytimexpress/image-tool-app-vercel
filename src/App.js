import React, { useState, useEffect } from 'react';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// --- Local Development Setup for Canvas/Immersive Document Variables ---
// এই অংশটি শুধুমাত্র লোকাল ডেভেলপমেন্ট এনভায়রনমেন্টের জন্য,
// যখন Canvas/Immersive Document এনভায়রনমেন্টে চলবে, তখন আসল মানগুলো স্বয়ংক্রিয়ভাবে পাওয়া যাবে।
if (typeof window.__firebase_config === 'undefined' && process.env.NODE_ENV !== 'production') {
    // Development mode, define mock global variables for local testing
    window.__firebase_config = JSON.stringify({
        apiKey: "YOUR_FIREBASE_API_KEY", // এখানে তোমার Firebase প্রজেক্টের আসল API Key বসাও (যদি লোকালি Firestore টেস্ট করতে চাও)
        authDomain: "YOUR_FIREBASE_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_FIREBASE_PROJECT_ID",
        storageBucket: "YOUR_FIREBASE_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    });
    window.__app_id = "mock-app-id";
    window.__initial_auth_token = "mock-auth-token"; // এই টোকেন লোকাল অথেন্টিকেশনে ব্যবহৃত হয় না
}
// --- End Local Development Setup ---


// Ensure Firebase is initialized and auth is handled
// 'window.__firebase_config' থেকে কনফিগারেশন নাও
const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {};
const app = Object.keys(firebaseConfig).length ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// Function to safely get the appId
const getAppId = () => typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';

// Function to safely get the auth token
const getAuthToken = () => typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null;


function App() {
    const [image, setImage] = useState(null);
    const [title, setTitle] = useState('');
    const [keywords, setKeywords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        // এই useEffect টি নিশ্চিত করে যে Firebase Auth প্রস্তুত হয়েছে এবং userId সেট হয়েছে।
        // এটি Firestore অপারেশন করার আগে প্রয়োজনীয়।
        if (!auth) {
            console.error("Firebase Auth instance is not available.");
            // যদি 'auth' অবজেক্ট না থাকে, সম্ভবত Firebase কনফিগারেশন সেটআপ হয়নি।
            // এই ক্ষেত্রে, Firebase-এর উপর নির্ভরশীল অংশগুলি কাজ করবে না।
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) { // যদি কোনো ব্যবহারকারী লগইন না থাকে
                try {
                    const token = getAuthToken();
                    // যদি আসল অথ টোকেন থাকে (mock token না হয়)
                    if (token && token !== "mock-auth-token") {
                        await signInWithCustomToken(auth, token);
                    } else {
                        // লোকাল ডেভেলপমেন্টে বা আসল টোকেন না থাকলে অ্যানোনিমাসলি সাইন ইন করো
                        await signInAnonymously(auth);
                    }
                } catch (err) {
                    console.error("Firebase authentication error during sign-in:", err);
                    setError("Firebase authentication failed. Please check your Firebase setup.");
                }
            }
            // ব্যবহারকারীর ID সেট করো, যদি অথেন্টিকেটেড হয় তাহলে UID, অন্যথায় একটি র্যান্ডম ID
            setUserId(auth.currentUser?.uid || crypto.randomUUID());
            setIsAuthReady(true); // অথেন্টিকেশন প্রক্রিয়া সম্পন্ন হয়েছে নির্দেশ করো
        });

        // কম্পোনেন্ট আনমাউন্ট হলে সাবস্ক্রিপশন বন্ধ করো
        return () => unsubscribe();
    }, [auth]); // 'auth' এখানে একটি প্রয়োজনীয় ডিপেন্ডেন্সি, কারণ useEffect এর ভেতরের লজিক 'auth' অবজেক্টের উপর নির্ভরশীল।


    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // ছবির প্রকারভেদ চেক করা
            if (!file.type.startsWith('image/')) {
                setError('শুধুমাত্র ছবি ফাইল আপলোড করুন।');
                setImage(null);
                setPreviewUrl(null);
                return;
            }
            // ছবির আকার চেক করা (5MB এর বেশি হলে)
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('ছবির আকার 5MB এর বেশি হতে পারবে না।');
                setImage(null);
                setPreviewUrl(null);
                return;
            }

            setError(''); // কোনো ত্রুটি থাকলে তা সরিয়ে ফেলো
            const reader = new FileReader(); // FileReader ব্যবহার করে ছবি পড়ো
            reader.onloadend = () => {
                setImage(reader.result); // Base64 স্ট্রিং হিসেবে ছবি সেট করো
                setPreviewUrl(reader.result); // প্রিভিউ দেখানোর জন্য URL সেট করো
            };
            reader.readAsDataURL(file); // ছবিটি Base64 Data URL হিসেবে পড়ো
        } else {
            setImage(null);
            setPreviewUrl(null);
        }
    };

    const handleGenerate = async () => {
        // ছবি আপলোড না থাকলে জেনারেট করা যাবে না
        if (!image) {
            setError('অনুগ্রহ করে একটি ছবি আপলোড করুন।');
            return;
        }
        // Firebase Auth এবং Firestore প্রস্তুত না হলে অপেক্ষা করো
        if (!isAuthReady || !userId || !db) {
            setError('অ্যাপ্লিকেশন প্রস্তুত হচ্ছে, অনুগ্রহ করে একটু অপেক্ষা করুন।');
            console.warn("Firestore not ready or userId not set. isAuthReady:", isAuthReady, "userId:", userId, "db:", db);
            return;
        }

        setLoading(true); // লোডিং স্টেট সেট করো
        setError(''); // ত্রুটি বার্তা পরিষ্কার করো
        setTitle(''); // আগের টাইটেল পরিষ্কার করো
        setKeywords([]); // আগের কিওয়ার্ড পরিষ্কার করো

        // ছবির MIME টাইপ এবং Base64 ডেটা আলাদা করো
        const imageMimeType = image.substring(image.indexOf(':') + 1, image.indexOf(';'));
        const base64ImageData = image.split(',')[1]; // "data:image/jpeg;base64," অংশটি বাদ দাও

        // Gemini API এর জন্য প্রম্পট তৈরি করো
        const prompt = `এই ছবিটির উপর ভিত্তি করে, অ্যাডোব স্টকের সাধারণ নির্দেশিকা (যেমন, বর্ণনামূলক, অনন্য, বাজারযোগ্য) অনুসরণ করে একটি ট্রেন্ডি, আকর্ষণীয় শিরোনাম তৈরি করুন। এছাড়াও, ছবির বিষয়বস্তুর সাথে অত্যন্ত প্রাসঙ্গিক প্রায় ৪৫টি একক-শব্দের কিওয়ার্ড দিন। নিশ্চিত করুন যে কিওয়ার্ডগুলি স্বতন্ত্র এবং ছবিতে থাকা মূল উপাদান, ধারণা এবং শৈলীকে উপস্থাপন করে। শুধুমাত্র একক শব্দ ব্যবহার করুন।`;

        // API কলের জন্য পে-লোড (payload) তৈরি করো
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

        const apiKey = ""; // Canvas পরিবেশ এই API Key স্বয়ংক্রিয়ভাবে সরবরাহ করবে
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            // Gemini API কল করো
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            // API রেসপন্স প্রক্রিয়া করো
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const json = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(json);

                setTitle(parsedJson.title || ''); // টাইটেল সেট করো
                setKeywords(Array.isArray(parsedJson.keywords) ? parsedJson.keywords : []); // কিওয়ার্ড সেট করো

                // জেনারেট করা ডেটা Firestore এ সেভ করো
                const appId = getAppId();
                // প্রাইভেট ডেটার জন্য Firestore পাথ: artifacts/{appId}/users/{userId}/{your_collection_name}
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/generated_data`, `data_${Date.now()}`);
                await setDoc(userDocRef, {
                    timestamp: new Date(),
                    imageMimeType: imageMimeType,
                    title: parsedJson.title || '',
                    keywords: Array.isArray(parsedJson.keywords) ? parsedJson.keywords : [],
                    userId: userId // ভবিষ্যতে ব্যবহারের জন্য userId সেভ করো
                });

            } else {
                setError('জেনারেশন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
                console.error("Unexpected API response structure:", result);
            }
        } catch (err) {
            setError('জেনারেশন প্রক্রিয়ায় একটি ত্রুটি হয়েছে: ' + err.message);
            console.error("API call error:", err);
        } finally {
            setLoading(false); // লোডিং স্টেট বন্ধ করো
        }
    };

    // ক্লিপবোর্ডে কপি করার ফাংশন
    const copyToClipboard = (text, type) => {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = text;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        try {
            document.execCommand('copy');
            // alert(`${type} কপি করা হয়েছে!`); // কাস্টম মডাল ব্যবহার করা উচিত, তবে এখানে সরলতার জন্য alert ব্যবহার করা হয়েছে
            // কাস্টম নোটিফিকেশন UI ব্যবহার করতে পারো এখানে alert() এর পরিবর্তে
            const messageBox = document.createElement('div');
            messageBox.textContent = `${type} কপি করা হয়েছে!`;
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
            }, 10); // Small delay to trigger transition
            setTimeout(() => {
                messageBox.style.opacity = '0';
                messageBox.addEventListener('transitionend', () => messageBox.remove());
            }, 2000); // Hide after 2 seconds

        } catch (err) {
            console.error('কপি করতে ব্যর্থ:', err);
            // alert('কপি করতে ব্যর্থ হয়েছে।');
            const messageBox = document.createElement('div');
            messageBox.textContent = 'কপি করতে ব্যর্থ হয়েছে।';
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
            <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg border border-opacity-20 border-white rounded-xl shadow-2xl p-8 max-w-4xl w-full flex flex-col md:flex-row gap-8">
                {/* Left Panel: Image Upload & Preview */}
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <h2 className="text-3xl font-bold mb-6 text-white text-center">ইমেজ টাইটেল ও কিওয়ার্ড জেনারেটর</h2>
                    <div className="w-full h-64 border-2 border-dashed border-gray-300 border-opacity-50 rounded-lg flex items-center justify-center relative overflow-hidden bg-gray-700 bg-opacity-30 mb-6">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg" />
                        ) : (
                            <span className="text-gray-300 text-lg">এখানে ছবি আপলোড করুন</span>
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
                        {loading ? 'জেনারেট হচ্ছে...' : 'টাইটেল ও কিওয়ার্ড জেনারেট করুন'}
                    </button>
                    {error && (
                        <p className="text-red-300 text-sm mt-2 text-center">{error}</p>
                    )}
                    {userId && (
                        <p className="text-gray-300 text-xs mt-4 break-all">ইউজার আইডি: {userId}</p>
                    )}
                </div>

                {/* Right Panel: Output */}
                <div className="flex-1 flex flex-col p-4">
                    <h3 className="text-2xl font-bold mb-4 text-white">জেনারেট করা ফলাফল</h3>

                    {/* Title Output */}
                    <div className="mb-6">
                        <label className="block text-gray-300 text-sm font-bold mb-2">টাইটেল:</label>
                        <div className="relative">
                            <textarea
                                readOnly
                                value={title}
                                className="w-full p-3 pr-12 rounded-lg bg-gray-800 bg-opacity-50 border border-gray-600 text-white focus:outline-none focus:border-purple-400 resize-none h-24 scrollbar-thin scrollbar-thumb-purple-400 scrollbar-track-gray-700"
                                placeholder="এখানে জেনারেট করা টাইটেল প্রদর্শিত হবে..."
                            ></textarea>
                            {title && (
                                <button
                                    onClick={() => copyToClipboard(title, 'টাইটেল')}
                                    className="absolute top-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition-colors duration-200"
                                    aria-label="কপি টাইটেল"
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
                        <label className="block text-gray-300 text-sm font-bold mb-2">কিওয়ার্ডস (মোট {keywords.length}টি):</label>
                        <div className="relative">
                            <div className="w-full min-h-[100px] p-3 pr-12 rounded-lg bg-gray-800 bg-opacity-50 border border-gray-600 text-white focus:outline-none focus:border-purple-400 flex flex-wrap gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-400 scrollbar-track-gray-700 max-h-48">
                                {keywords.length > 0 ? (
                                    keywords.map((kw, index) => (
                                        <span key={index} className="bg-blue-600 bg-opacity-70 text-white text-xs px-3 py-1 rounded-full shadow-md">
                                            {kw}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-gray-400">এখানে জেনারেট করা কিওয়ার্ড প্রদর্শিত হবে...</span>
                                )}
                            </div>
                            {keywords.length > 0 && (
                                <button
                                    onClick={() => copyToClipboard(keywords.join(', '), 'কিওয়ার্ডস')}
                                    className="absolute top-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition-colors duration-200"
                                    aria-label="কপি কিওয়ার্ডস"
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
