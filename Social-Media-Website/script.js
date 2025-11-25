let posts = JSON.parse(localStorage.getItem("posts")) || [];

function savePosts() {
    localStorage.setItem("posts", JSON.stringify(posts));
}

function createPost() {
    let text = document.getElementById("postText").value;
    let img = document.getElementById("postImage").value;

    if (!text) {
        alert("Write something first!");
        return;
    }

    posts.unshift({
        text,
        img,
        likes: 0,
        time: new Date().toLocaleString()
    });

    savePosts();
    showPosts();

    document.getElementById("postText").value = "";
    document.getElementById("postImage").value = "";
}

function likePost(i) {
    posts[i].likes++;
    savePosts();
    showPosts();
}

function deletePost(i) {
    posts.splice(i, 1);
    savePosts();
    showPosts();
}

function showPosts() {
    let feed = document.getElementById("feed");
    feed.innerHTML = "";

    posts.forEach((p, i) => {
        feed.innerHTML += `
            <div class="post">
                <p>${p.text}</p>
                ${p.img ? `<img src="${p.img}" width="100%">` : ""}
                <small>${p.time}</small><br>

                <button onclick="likePost(${i})">❤️ ${p.likes}</button>
                <button onclick="deletePost(${i})">🗑 Delete</button>
            </div>
            <hr>
        `;
    });
}

showPosts();

// Initialize Lucide icons
        lucide.createIcons();
        
        // --- LOCAL STORAGE & AUTH REPLACEMENT ---
        const STORAGE_KEY = 'nexusFeedPosts';
        const USER_ID_KEY = 'nexusFeedUserId';
        let currentUserId;
        
        // 1. Local Storage Utility Functions
        function loadPosts() {
            try {
                const postsJson = localStorage.getItem(STORAGE_KEY);
                return postsJson ? JSON.parse(postsJson) : [];
            } catch (e) {
                console.error("Error loading posts from localStorage:", e);
                return [];
            }
        }

        function saveAllPosts(posts) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
            } catch (e) {
                console.error("Error saving posts to localStorage:", e);
            }
        }

        // 2. User ID Setup (Replaces Firebase Auth)
        function initializeLocalUser() {
            let userId = localStorage.getItem(USER_ID_KEY);
            if (!userId) {
                // Generate a unique ID (using a simplified approach since crypto.randomUUID might be unavailable in some contexts)
                userId = 'user-' + Math.random().toString(36).substring(2, 9);
                localStorage.setItem(USER_ID_KEY, userId);
            }
            currentUserId = userId;
            document.getElementById('local-user-id').textContent = `ID: ${currentUserId.substring(0, 8)}...`;
            console.log("Local User ID initialized:", currentUserId);
        }

        // 3. Data Mutation Functions (Replace Firestore Operations)
        window.saveNewPost = (content, mediaUrl) => {
            const allPosts = loadPosts();
            
            const newPost = {
                id: Date.now().toString(), // Use timestamp as a simple unique ID
                userId: currentUserId,
                userName: 'Aapka Post (' + currentUserId.substring(0, 4) + '...)',
                content: content,
                mediaUrl: mediaUrl,
                likes: 0,
                commentsCount: 0, // Simulated count
                timestamp: new Date().toISOString() // Store ISO string for date/time
            };

            allPosts.push(newPost);
            saveAllPosts(allPosts);
            
            // Manually re-trigger rendering after save
            loadAndRenderPosts(); 
            showToast('Post successfully saved to Local Storage!');
        };

        window.deletePostById = (postId, postUserId) => {
            if (currentUserId !== postUserId) {
                showToast("Aap sirf apni hi posts delete kar sakte hain.", true);
                return;
            }
            
            let allPosts = loadPosts();
            const initialLength = allPosts.length;
            
            // Filter out the post
            allPosts = allPosts.filter(post => post.id !== postId);
            
            if (allPosts.length < initialLength) {
                saveAllPosts(allPosts);
                loadAndRenderPosts(); // Manually re-trigger rendering after delete
                showToast('Post has been deleted successfully!');
            } else {
                 showToast('Post not found.', true);
            }
        };

        // --- SIMULATED DATA STORE FOR COMMENTS (Still in use) ---
        const commentsData = {}; 
        
        // Constants for Gemini API
        const GEMINI_API_KEY = ""; 
        const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025';

        // Get UI elements
        const postsContainer = document.getElementById('posts-container');
        const postModal = document.getElementById('post-modal');
        const modalPostInput = document.getElementById('modal-post-input');
        const mediaUrlInput = document.getElementById('media-url');
        const mediaPreview = document.getElementById('media-preview');
        const openModalMobile = document.getElementById('open-post-modal-mobile');
        const openModalDesktop = document.getElementById('open-post-modal-desktop');
        const closeModalButton = document.getElementById('close-post-modal');
        const modalPostButton = document.getElementById('modal-post-button');
        const suggestHashtagsButton = document.getElementById('suggest-hashtags-button');
        const loadingOverlay = document.getElementById('loading-overlay');
        const searchInput = document.getElementById('search-input'); // Search input element

        // --- Global State ---
        let allPostsCache = []; // To store all posts received from LocalStorage
        // --- Global State ---

        // Helper function for showing temporary toast messages
        function showToast(message, isError = false) {
            const toast = document.getElementById('toast-message-box');
            toast.textContent = message;
            
            toast.classList.remove('opacity-0', 'pointer-events-none', 'bg-gray-900', 'bg-red-600');
            toast.classList.add('opacity-100', isError ? 'bg-red-600' : 'bg-gray-900');

            setTimeout(() => {
                toast.classList.remove('opacity-100');
                toast.classList.add('opacity-0', 'pointer-events-none');
            }, 3000);
        }
        // Expose to module script
        window.showToast = showToast;
        
        // --- Gemini API Call Function with Backoff ---
        async function callGeminiApi(userQuery, systemPrompt, maxRetries = 3) {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            };

            for (let i = 0; i < maxRetries; i++) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    } else if (response.status === 429 && i < maxRetries - 1) {
                        // Rate limit error, retry with exponential backoff
                        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue; 
                    } else {
                        throw new Error(`API call failed with status: ${response.status}`);
                    }
                } catch (error) {
                    console.error("Gemini API Request Error:", error);
                    if (i === maxRetries - 1) throw error; // Re-throw if last retry
                    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // --- Hashtag Suggestion Logic (Gemini Feature) ---
        suggestHashtagsButton.addEventListener('click', async () => {
            const postText = modalPostInput.value.trim();

            if (postText.length < 10) {
                showToast("Please write at least 10 characters for better hashtag suggestions.", true);
                return;
            }

            loadingOverlay.style.display = 'flex';
            suggestHashtagsButton.disabled = true;

            const systemPrompt = "Aap ek creative social media marketing expert hain. Aapka kaam hai di gayi post ke liye paanch (5) sabse behtareen aur trending hashtags generate karna. Sirf hashtags dein, aur koi text nahin. Har hashtag ke aage '#' hona chahiye aur unke beech mein space hona chahiye. Udaharan: #travel #nature #photography #adventure #wanderlust";
            const userQuery = `Is post ke liye hashtags suggest karo: "${postText}"`;

            try {
                const suggestedHashtags = await callGeminiApi(userQuery, systemPrompt);
                
                if (suggestedHashtags.trim()) {
                    // Check if the input already ends with text, add a space if necessary
                    const currentContent = modalPostInput.value;
                    const separator = currentContent.endsWith(' ') || currentContent.endsWith('\n') ? '' : ' ';
                    
                    modalPostInput.value += separator + suggestedHashtags.trim();
                    showToast("Hashtags successfully generated and added!");
                } else {
                    showToast("Could not generate hashtags. Please try again.", true);
                }

            } catch (error) {
                console.error("Hashtag Generation Error:", error);
                showToast("Error: Could not connect to Gemini API.", true);
            } finally {
                loadingOverlay.style.display = 'none';
                suggestHashtagsButton.disabled = false;
            }
        });


        // --- Comment System Logic (Simulation) ---

        // Function to render comments for a specific post
        function renderComments(postId) {
            const commentsList = document.getElementById(`existing-comments-${postId}`);
            if (!commentsList) return;

            commentsList.innerHTML = '';
            const comments = commentsData[postId] || [];
            
            if (comments.length === 0) {
                commentsList.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">No comments yet. Be the first!</p>';
                return;
            }

            // Render comments in reverse order (newest first)
            [...comments].reverse().forEach(comment => {
                const commentHtml = `
                    <div class="flex space-x-3 items-start p-2 bg-gray-50 rounded-xl">
                        <div class="flex-shrink-0 w-8 h-8 bg-gray-300 rounded-full overflow-hidden">
                            <img src="https://placehold.co/32x32/10b981/ffffff?text=${comment.user[0]}" onerror="this.onerror=null;this.src='https://placehold.co/32x32/10b981/ffffff?text=${comment.user[0]}';" alt="Avatar" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-grow">
                            <p class="font-semibold text-sm text-gray-900 leading-tight">${comment.user}</p>
                            <p class="text-gray-700 text-sm whitespace-pre-wrap">${comment.content}</p>
                            <p class="text-xs text-gray-500 mt-1">${comment.timestamp}</p>
                        </div>
                    </div>
                `;
                commentsList.insertAdjacentHTML('beforeend', commentHtml);
            });
        }
        
        // Function to handle comment submission (simulation)
        function handleCommentSubmit(postId) {
            const inputElement = document.getElementById(`comment-input-${postId}`);
            const commentText = inputElement.value.trim();
            if (!commentText) {
                showToast("Comment khaali nahin ho sakta.", true);
                return;
            }
            
            const user = 'Aapka Post'; 

            const newComment = {
                user: user,
                content: commentText,
                timestamp: 'Just now'
            };

            if (!commentsData[postId]) {
                commentsData[postId] = [];
            }
            commentsData[postId].push(newComment);
            
            // Update the comment count span (Note: This is simulated)
            const countSpan = document.querySelector(`.comment-count-${postId}`);
            if (countSpan) {
                // Since this count is simulated, we update the display locally.
                const currentCountText = countSpan.textContent.split(' ')[0];
                const currentCount = isNaN(parseInt(currentCountText)) ? 0 : parseInt(currentCountText);
                countSpan.textContent = `${currentCount + 1} Comments`;
            }

            renderComments(postId);
            inputElement.value = '';
            showToast("Comment post ho gaya!");
        }
        
        // Helper function to create the Lucide icon HTML
        function getIconHtml(name, classes = 'w-5 h-5') {
            return `<i data-lucide="${name}" class="${classes}"></i>`;
        }

        // Function to format timestamp
        function formatTimestamp(timestampString) {
            if (!timestampString) return 'Loading...';
            // Parse ISO string back to Date object
            const timestamp = new Date(timestampString);
            const seconds = (new Date().getTime() - timestamp.getTime()) / 1000;

            if (seconds < 60) return `${Math.floor(seconds)} seconds ago`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
            return timestamp.toLocaleDateString();
        }

        // --- Post Rendering and Event Handlers (LocalStorage Driven) ---

        // Function to attach event listeners to a new post element
        function attachPostEventListeners(postElement, postData) {
            const postId = postData.id;

            // Attach delete handler (The requested confirmation logic is here)
            const deleteButton = postElement.querySelector('.delete-post-button');
            if (deleteButton) {
                deleteButton.addEventListener('click', (e) => {
                    // This is the confirmation dialog you requested
                    if (window.confirm('Kya aap is post ko delete karna chahte hain?')) {
                        // Call the globally exposed delete function
                        window.deletePostById(postId, postData.userId); 
                    }
                });
            }
            
            // Attach like handler (FIXED ERROR LOGIC)
            postElement.querySelector('.like-button')?.addEventListener('click', (e) => {
                let currentButton = e.currentTarget;
                let textSpan = currentButton.querySelector('span:last-child');
                let iconContainer = currentButton.querySelector('.like-icon-container');
                let isLiked = currentButton.getAttribute('data-liked') === 'true';
                let currentLikes = parseInt(textSpan.textContent.split(' ')[0]) || 0;

                if (!iconContainer) {
                    console.error("Like button icon container not found. Cannot proceed.");
                    window.showToast("Like action failed due to a rendering error.", true);
                    return; 
                }

                if (isLiked) {
                    // Liked -> Unliked (Local Simulation Only)
                    currentButton.setAttribute('data-liked', 'false');
                    currentButton.classList.remove('text-red-600');
                    currentButton.classList.add('hover:text-red-600', 'hover:bg-red-50');
                    iconContainer.innerHTML = getIconHtml('heart'); 
                    textSpan.textContent = (currentLikes - 1) + ' Likes';
                    window.showToast('You unliked this post.');
                } else {
                    // Unliked -> Liked (Local Simulation Only)
                    currentButton.setAttribute('data-liked', 'true');
                    currentButton.classList.remove('hover:text-red-600', 'hover:bg-red-50');
                    currentButton.classList.add('text-red-600');
                    iconContainer.innerHTML = getIconHtml('heart-fill'); 
                    textSpan.textContent = (currentLikes + 1) + ' Likes';
                    window.showToast('You liked this post!');
                }
                lucide.createIcons();
            });

            // Attach comment button handler
            postElement.querySelector('.comment-button')?.addEventListener('click', () => {
                const commentsContainer = postElement.querySelector('.comments-section'); // Find inside this post
                if (commentsContainer.classList.contains('hidden')) {
                    renderComments(postId); // Load comments before showing
                    commentsContainer.classList.remove('hidden');
                } else {
                    commentsContainer.classList.add('hidden');
                }
            });

            // Attach comment submit handler
            postElement.querySelector('.submit-comment-button')?.addEventListener('click', (e) => {
                const submitPostId = e.currentTarget.getAttribute('data-post-id');
                handleCommentSubmit(submitPostId);
            });
        }

        // Function to generate the HTML for a new post
        function createPostElement(post) {
            const postId = post.id;
            const user = post.userName || 'Unknown User';
            const content = post.content || 'No content';
            const mediaUrl = post.mediaUrl || '';
            const timestamp = formatTimestamp(post.timestamp);
            const isOwner = post.userId === currentUserId;

            const postDiv = document.createElement('div');
            postDiv.classList.add('bg-white', 'p-6', 'rounded-xl', 'shadow-xl', 'border', 'border-gray-100', 'post-item');
            postDiv.setAttribute('data-post-id', postId);

            // Dynamic Media HTML
            const mediaHtml = mediaUrl ? `
                <div class="w-full rounded-lg overflow-hidden mb-4 border border-gray-200">
                    ${mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? 
                        `<video src="${mediaUrl}" controls class="w-full h-auto max-h-96 object-contain bg-black" onerror="this.onerror=null;this.src='https://placehold.co/600x400/ef4444/ffffff?text=Video+Load+Failed';" title="Video Post"></video>` :
                        `<img src="${mediaUrl}" onerror="this.onerror=null;this.src='https://placehold.co/600x400/ef4444/ffffff?text=Image+Load+Failed';" alt="Post Media" class="w-full h-auto object-cover">`
                    }
                </div>
            ` : '';

            postDiv.innerHTML = `
                <!-- Post Header -->
                <div class="flex items-center space-x-3 mb-4 justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-gray-300 rounded-full overflow-hidden flex-shrink-0">
                            <img src="https://placehold.co/48x48/60a5fa/ffffff?text=${user[0]}" onerror="this.onerror=null;this.src='https://placehold.co/48x48/60a5fa/ffffff?text=${user[0]}';" alt="User Avatar" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <p class="font-bold text-gray-900">${user}</p>
                            <!-- Showing full User ID for multi-user collaboration -->
                            <p class="text-sm text-gray-500">User ID: ${post.userId} • ${timestamp}</p>
                        </div>
                    </div>
                    <!-- Delete Button (Only visible to the post owner) -->
                    ${isOwner ? `
                    <button class="text-gray-400 hover:text-red-500 delete-post-button" title="Delete Post">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>` : ''}
                </div>

                <!-- Post Content -->
                <p class="text-gray-800 mb-4 whitespace-pre-wrap">${content}</p>
                ${mediaHtml}

                <!-- Post Actions -->
                <div class="flex justify-around border-t border-gray-100 pt-3 text-gray-500">
                    <button class="flex items-center space-x-2 p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition duration-150 like-button" data-post-id="${postId}" data-liked="false">
                        <span class="like-icon-container">
                            <i data-lucide="heart" class="w-5 h-5"></i>
                        </span>
                        <span class="text-sm font-medium">${post.likes || 0} Likes</span>
                    </button>
                    <button class="flex items-center space-x-2 p-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition duration-150 comment-button" data-post-id="${postId}">
                        <i data-lucide="message-circle" class="w-5 h-5"></i>
                        <span class="text-sm font-medium comment-count-${postId}">${post.commentsCount || 0} Comments</span>
                    </button>
                    <button class="flex items-center space-x-2 p-2 rounded-lg hover:bg-green-50 hover:text-green-600 transition duration-150">
                        <i data-lucide="share-2" class="w-5 h-5"></i>
                        <span class="text-sm font-medium">0 Shares</span>
                    </button>
                </div>
                
                <!-- Comment Section -->
                <div id="comments-container-${postId}" class="comments-section mt-4 hidden border-t pt-4">
                    <!-- Comment Input Form -->
                    <div class="flex space-x-2 mb-4">
                        <input type="text" id="comment-input-${postId}" placeholder="Write a comment..." class="flex-grow p-2 border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm">
                        <button class="px-4 py-1 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700 transition duration-150 submit-comment-button" data-post-id="${postId}">
                            Send
                        </button>
                    </div>
                    <!-- Existing Comments -->
                    <div id="existing-comments-${postId}" class="space-y-3">
                        <p class="text-center text-sm text-gray-400">Comments will load here on click (simulated)...</p>
                    </div>
                </div>
            `;
            
            lucide.createIcons();
            attachPostEventListeners(postDiv, post); // Pass the full post object
            return postDiv;
        }

        // Function to filter posts based on search query and render the UI
        function filterAndRenderPosts(searchQuery = '') {
            const query = searchQuery.toLowerCase().trim();
            let filteredPosts = allPostsCache;

            if (query) {
                filteredPosts = allPostsCache.filter(post => 
                    (post.content && post.content.toLowerCase().includes(query)) ||
                    (post.userName && post.userName.toLowerCase().includes(query)) ||
                    (post.userId && post.userId.toLowerCase().includes(query))
                );
            }
            
            postsContainer.innerHTML = ''; // Clear existing posts

            if (filteredPosts.length === 0) {
                postsContainer.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-xl shadow-lg border border-gray-100">
                        <i data-lucide="frown" class="w-10 h-10 mx-auto mb-4 text-gray-400"></i>
                        <p class="text-gray-600 font-medium">${query ? 'Koi post nahin mili jo "' + query + '" se match karti ho.' : 'Koi post nahin mili. Pehla post banao!'}</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }

            filteredPosts.forEach(post => {
                const postElement = createPostElement(post);
                postsContainer.appendChild(postElement);
            });
            
            lucide.createIcons(); // Re-create icons for the rendered posts
        }
        
        // Function to load all posts from LocalStorage, sort, and trigger UI update
        function loadAndRenderPosts() {
            let posts = loadPosts();
            
            // Convert timestamp strings back to Date objects temporarily for sorting, then sort descending
            posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            allPostsCache = posts; // Update the global cache
            // Get the current search query and filter/render immediately
            const currentQuery = searchInput ? searchInput.value : '';
            filterAndRenderPosts(currentQuery);
        }

        // Expose necessary globals for backward compatibility if needed, but not required with this structure
        window.getCurrentUserId = () => currentUserId;


        // --- Modal Control and Media Preview ---
        function updateMediaPreview() {
            const url = mediaUrlInput.value.trim();
            mediaPreview.innerHTML = '';
            
            if (url) {
                mediaPreview.classList.remove('hidden');
                // Check if URL is for a video or image based on a simple extension check
                if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                    mediaPreview.innerHTML = `<img src="${url}" class="max-h-36 w-auto mx-auto rounded-lg object-contain" onerror="this.onerror=null;this.src='https://placehold.co/150x100/ef4444/ffffff?text=Image+Error';">`;
                } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
                    mediaPreview.innerHTML = `<video src="${url}" controls class="max-h-36 w-full rounded-lg object-contain bg-black" onerror="this.onerror=null;this.src='';"><p class="text-center text-sm text-white p-2">Video preview not available (check URL).</p></video>`;
                } else {
                    mediaPreview.innerHTML = `<p class="text-center text-sm text-gray-500 p-2">Media URL added: ${url.substring(0, 50)}...</p>`;
                }
            } else {
                mediaPreview.classList.add('hidden');
            }
        }
        
        mediaUrlInput.addEventListener('input', updateMediaPreview);


        function openPostModal() {
            postModal.style.display = 'flex';
            lucide.createIcons();
        }

        function closePostModal() {
            postModal.style.display = 'none';
            modalPostInput.value = ''; // Clear text input
            mediaUrlInput.value = ''; // Clear media input
            mediaPreview.classList.add('hidden'); // Hide preview
        }

        // Event listeners for opening and closing the modal
        openModalMobile.addEventListener('click', openPostModal);
        openModalDesktop.addEventListener('click', openPostModal);
        closeModalButton.addEventListener('click', closePostModal);

        // Logic for posting from the modal (Now uses LocalStorage function)
        modalPostButton.addEventListener('click', () => {
            const content = modalPostInput.value.trim();
            const mediaUrl = mediaUrlInput.value.trim();

            if (content.length === 0 && mediaUrl.length === 0) {
                window.showToast('Post khaali nahin ho sakta. Kuchh likhiye ya media add kijiye.', true);
                return;
            }
            
            // Call the globally exposed LocalStorage save function
            window.saveNewPost(content, mediaUrl);

            closePostModal();
        });
        
        // --- Follow Button Logic (Unchanged) ---
        document.querySelectorAll('.follow-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const currentButton = e.currentTarget;

                if (currentButton.textContent.trim() === 'Follow') {
                    // Not Following -> Follow
                    currentButton.classList.remove('bg-blue-500', 'hover:bg-blue-600', 'text-white');
                    currentButton.classList.add('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700');
                    currentButton.textContent = 'Following';
                    showToast('Now following user!');
                } else {
                    // Currently Following -> Unfollow
                    currentButton.classList.remove('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700');
                    currentButton.classList.add('bg-blue-500', 'hover:bg-blue-600', 'text-white');
                    currentButton.textContent = 'Follow';
                    showToast('Unfollowed user.');
                }
            });
        });

        // --- Search Functionality ---
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                // Filter and render posts based on the new input value
                filterAndRenderPosts(searchInput.value);
            });
        }
        
        // --- App Start ---
        window.onload = () => {
            initializeLocalUser(); // Setup local user ID
            loadAndRenderPosts(); // Initial load and render
        };
function signupUser() {
    let name = document.getElementById("signupName").value;
    let email = document.getElementById("signupEmail").value;
    let pass = document.getElementById("signupPass").value;

    if (!name || !email || !pass) {
        alert("Please fill all fields");
        return;
    }

    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userPass", pass);

    alert("Signup Successful!");
    window.location.href = "login.html";
}

function loginUser() {
    let email = document.getElementById("loginEmail").value;
    let pass = document.getElementById("loginPass").value;

    let savedEmail = localStorage.getItem("userEmail");
    let savedPass = localStorage.getItem("userPass");

    if (email === savedEmail && pass === savedPass) {
        alert("Login Successful!");
        window.location.href = "home.html";
    } else {
        alert("Invalid Email or Password");
    }
}