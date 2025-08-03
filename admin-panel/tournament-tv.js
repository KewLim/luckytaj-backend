// Tournament TV Management JavaScript

class TournamentTVManager {
    constructor() {
        this.isAuthenticated = false;
        this.playlistVideos = [];
        this.currentVideoIndex = 0;
        this.currentVideoId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Video forms
        const youtubeForm = document.getElementById('youtubeForm');
        if (youtubeForm) {
            youtubeForm.addEventListener('submit', (e) => this.handleYouTubeSubmit(e));
        }

        const streamForm = document.getElementById('streamForm');
        if (streamForm) {
            streamForm.addEventListener('submit', (e) => this.handleStreamSubmit(e));
        }

        // Modal close events
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    checkAuthStatus() {
        const token = localStorage.getItem('adminToken');
        if (token) {
            this.validateToken(token);
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showDashboard(data.admin);
            } else {
                localStorage.removeItem('adminToken');
                this.showLogin();
            }
        } catch (error) {
            console.error('Token validation error:', error);
            localStorage.removeItem('adminToken');
            this.showLogin();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('adminToken', result.token);
                this.showDashboard(result.admin);
            } else {
                this.showError(result.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    handleLogout() {
        localStorage.removeItem('adminToken');
        this.showLogin();
    }

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
        this.isAuthenticated = false;
    }

    showDashboard(admin) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('adminEmail').textContent = admin.email;
        this.isAuthenticated = true;
        this.loadPlaylist();
        this.loadCurrentVideo();
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    // Tournament TV Playlist Management
    loadPlaylist() {
        // For now, we'll use the hardcoded tournament TV videos from the script
        // This simulates loading from a database or API
        this.playlistVideos = [
            'Fr3bXkHriGM', 
            'POl3GtraHeo&t',
            'ma5lm-ExMaA',
            'akm4ys-WUN0',
            'n14gIPk9_yo',
            'GPXxOzK8A50',
            'f0tUF8RLHwE',
            'CfrVafvX3XI',
            'D8g38fkFHFw',
            'be1pSS2NSbY',
            '7Bw0FSjSRpI',
            'sZo46xEeOi4',
            'GQUl8O97-S8',
        ];

        this.renderPlaylist();
    }

    loadCurrentVideo() {
        if (this.playlistVideos.length === 0) return;

        // Simulate the same random selection logic as the frontend
        this.currentVideoIndex = Math.floor(Math.random() * this.playlistVideos.length);
        const videoId = this.playlistVideos[this.currentVideoIndex];
        
        this.displayCurrentVideo(videoId);
    }

    displayCurrentVideo(videoId) {
        const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        document.getElementById('currentThumbnail').src = thumbnail;
        document.getElementById('currentTitle').textContent = 'Tournament Live Stream';
        document.getElementById('currentDescription').textContent = 'Live tournament action and highlights';
        document.getElementById('currentType').textContent = 'YouTube';
    }

    renderPlaylist() {
        const container = document.getElementById('playlistContainer');
        
        if (this.playlistVideos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tv"></i>
                    <h3>No videos in playlist</h3>
                    <p>Add videos to create the tournament TV playlist</p>
                    <button class="btn btn-primary" onclick="openAddVideoModal()">
                        <i class="fas fa-plus"></i> Add First Video
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.playlistVideos.map((videoId, index) => 
            this.createPlaylistItem(videoId, index)
        ).join('');
    }

    createPlaylistItem(videoId, index) {
        const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const isCurrentVideo = index === this.currentVideoIndex;
        
        return `
            <div class="video-history-item ${isCurrentVideo ? 'current-playing' : ''}">
                <div class="video-history-thumbnail" onclick="previewVideo('${videoId}')">
                    <img src="${thumbnail}" alt="Video thumbnail">
                    <div class="video-history-play">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
                <div class="video-history-details">
                    <div class="video-history-info">
                        <h4>Tournament Video ${index + 1} ${isCurrentVideo ? '(Currently Playing)' : ''}</h4>
                        <p>Tournament highlights and live action</p>
                        <div class="video-meta">
                            <span>YouTube</span> • <span>Video ID: ${videoId}</span>
                        </div>
                    </div>
                    <div class="video-history-actions">
                        <button class="btn-small btn-preview" onclick="previewVideo('${videoId}')">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button class="btn-small btn-edit" onclick="editVideo(${index})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-small btn-delete" onclick="deleteVideo(${index})">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async handleYouTubeSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const videoUrl = formData.get('videoUrl');
        
        // Extract video ID from YouTube URL
        const videoId = this.extractYouTubeId(videoUrl);
        if (!videoId) {
            alert('Invalid YouTube URL. Please check the URL and try again.');
            return;
        }

        try {
            this.showLoading();
            
            // Add to playlist (for now, just add to the local array)
            // In a real implementation, this would save to a database
            this.playlistVideos.push(videoId);
            
            this.closeVideoModal();
            this.renderPlaylist();
            this.showSuccess('Video added to tournament TV playlist');
            
        } catch (error) {
            console.error('Add video error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleStreamSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const streamUrl = formData.get('streamUrl');
        
        try {
            this.showLoading();
            
            // For live streams, we would handle differently
            // This is a placeholder for live stream integration
            alert('Live stream integration coming soon!');
            
        } catch (error) {
            console.error('Add stream error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    extractYouTubeId(url) {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // Modal Management
    openAddVideoModal() {
        document.getElementById('videoModal').style.display = 'flex';
        this.resetForms();
    }

    closeVideoModal() {
        document.getElementById('videoModal').style.display = 'none';
        this.resetForms();
    }

    closeDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.currentVideoId = null;
    }

    closeAllModals() {
        this.closeVideoModal();
        this.closeDeleteModal();
    }

    resetForms() {
        document.getElementById('youtubeForm').reset();
        document.getElementById('streamForm').reset();
    }

    switchVideoTab(type) {
        // Update tab buttons
        document.querySelectorAll('.video-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`).classList.add('active');

        // Update forms
        document.querySelectorAll('.video-form').forEach(form => {
            form.classList.remove('active');
        });
        
        if (type === 'youtube') {
            document.getElementById('youtubeForm').classList.add('active');
        } else {
            document.getElementById('streamForm').classList.add('active');
        }
    }
}

// Global functions for inline event handlers
let tournamentTVManager;

function openAddVideoModal() {
    tournamentTVManager.openAddVideoModal();
}

function closeVideoModal() {
    tournamentTVManager.closeVideoModal();
}

function closeDeleteModal() {
    tournamentTVManager.closeDeleteModal();
}

function switchVideoTab(type) {
    tournamentTVManager.switchVideoTab(type);
}

function loadPlaylist() {
    tournamentTVManager.loadPlaylist();
}

function playCurrentVideo() {
    // Open current video in new tab
    if (tournamentTVManager.playlistVideos.length > 0) {
        const videoId = tournamentTVManager.playlistVideos[tournamentTVManager.currentVideoIndex];
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
}

function previewVideo(videoId) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
}

function editVideo(index) {
    const videoId = tournamentTVManager.playlistVideos[index];
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Pre-fill the form with existing data
    document.getElementById('youtubeUrl').value = videoUrl;
    switchVideoTab('youtube');
    
    // Store the index for updating
    tournamentTVManager.editingIndex = index;
    
    openAddVideoModal();
}

function deleteVideo(index) {
    tournamentTVManager.editingIndex = index;
    document.getElementById('deleteModal').style.display = 'flex';
}

function confirmDelete() {
    if (tournamentTVManager.editingIndex !== undefined) {
        // Remove from playlist
        tournamentTVManager.playlistVideos.splice(tournamentTVManager.editingIndex, 1);
        
        // Update current video index if needed
        if (tournamentTVManager.currentVideoIndex >= tournamentTVManager.editingIndex) {
            tournamentTVManager.currentVideoIndex = Math.max(0, tournamentTVManager.currentVideoIndex - 1);
        }
        
        tournamentTVManager.closeDeleteModal();
        tournamentTVManager.renderPlaylist();
        tournamentTVManager.loadCurrentVideo();
        tournamentTVManager.showSuccess('Video removed from playlist');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    tournamentTVManager = new TournamentTVManager();
});