// Video Management JavaScript

class VideoManager {
    constructor() {
        this.isAuthenticated = false;
        this.videos = [];
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

        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => this.handleUploadSubmit(e));
        }

        // File upload drag and drop
        const fileUploadArea = document.getElementById('fileUploadArea');
        if (fileUploadArea) {
            this.setupFileUpload(fileUploadArea);
        }

        // Modal close events
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    setupFileUpload(uploadArea) {
        const fileInput = uploadArea.querySelector('input[type="file"]');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                this.handleFileSelect(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });
    }

    handleFileSelect(file) {
        const uploadContent = document.querySelector('.file-upload-content');
        if (file) {
            uploadContent.innerHTML = `
                <i class="fas fa-file-video"></i>
                <p><strong>Selected:</strong> ${file.name}</p>
                <small>Size: ${this.formatFileSize(file.size)}</small>
            `;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        this.loadVideos();
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    async loadVideos() {
        if (!this.isAuthenticated) return;

        try {
            this.showLoading();
            
            const response = await fetch('/api/video/all', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (response.ok) {
                this.videos = await response.json();
                this.renderVideos();
                this.updateStats();
            } else {
                throw new Error('Failed to load videos');
            }
        } catch (error) {
            console.error('Load videos error:', error);
            this.showVideoError('Failed to load videos');
        } finally {
            this.hideLoading();
        }
    }

    renderVideos() {
        const videoList = document.getElementById('videoList');
        
        if (this.videos.length === 0) {
            videoList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video"></i>
                    <h3>No videos found</h3>
                    <p>Start by adding your first video to the library</p>
                    <button class="btn btn-primary" onclick="openAddVideoModal()">
                        <i class="fas fa-plus"></i> Add Video
                    </button>
                </div>
            `;
            return;
        }

        const filteredVideos = this.getFilteredVideos();
        
        videoList.innerHTML = filteredVideos.map(video => this.createVideoCard(video)).join('');
    }

    getFilteredVideos() {
        const typeFilter = document.getElementById('filterType').value;
        const statusFilter = document.getElementById('filterStatus').value;
        
        return this.videos.filter(video => {
            const typeMatch = typeFilter === 'all' || video.videoType === typeFilter;
            const statusMatch = statusFilter === 'all' || 
                               (statusFilter === 'active' && video.isActive) ||
                               (statusFilter === 'inactive' && !video.isActive);
            return typeMatch && statusMatch;
        });
    }

    createVideoCard(video) {
        const thumbnail = this.getVideoThumbnail(video);
        const createdDate = new Date(video.createdAt).toLocaleDateString();
        
        return `
            <div class="video-card">
                <div class="video-thumbnail">
                    ${thumbnail}
                    <div class="video-type-badge ${video.videoType}">${video.videoType.toUpperCase()}</div>
                    <div class="video-status-badge ${video.isActive ? 'active' : 'inactive'}">
                        ${video.isActive ? 'Active' : 'Inactive'}
                    </div>
                </div>
                <div class="video-info">
                    <h4 class="video-title">${video.title || 'Untitled Video'}</h4>
                    <p class="video-description">${video.description || 'No description provided'}</p>
                    <div class="video-meta">
                        <span>Added: ${createdDate}</span>
                        <span>By: ${video.uploadedBy?.email || 'Unknown'}</span>
                    </div>
                    <div class="video-actions">
                        <button class="btn-small btn-edit" onclick="editVideo('${video._id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-small btn-toggle ${video.isActive ? '' : 'inactive'}" 
                                onclick="toggleVideoStatus('${video._id}')">
                            <i class="fas fa-${video.isActive ? 'pause' : 'play'}"></i> 
                            ${video.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn-small btn-delete" onclick="deleteVideo('${video._id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getVideoThumbnail(video) {
        if (video.videoType === 'youtube') {
            // Extract video ID from URL
            const match = video.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
            if (match) {
                return `<img src="https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg" alt="Video thumbnail">`;
            }
        }
        
        return `<div class="placeholder-icon"><i class="fas fa-video"></i></div>`;
    }

    updateStats() {
        const total = this.videos.length;
        const active = this.videos.filter(v => v.isActive).length;
        const youtube = this.videos.filter(v => v.videoType === 'youtube').length;
        const uploaded = this.videos.filter(v => v.videoType === 'mp4').length;

        document.getElementById('totalVideos').textContent = total;
        document.getElementById('activeVideos').textContent = active;
        document.getElementById('youtubeVideos').textContent = youtube;
        document.getElementById('uploadedVideos').textContent = uploaded;
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showVideoError(message) {
        const videoList = document.getElementById('videoList');
        videoList.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-exclamation-triangle"></i>
                ${message}
            </div>
        `;
    }

    // Modal Management
    openAddVideoModal() {
        document.getElementById('modalTitle').textContent = 'Add New Video';
        document.getElementById('editVideoId').value = '';
        this.resetForms();
        document.getElementById('videoModal').style.display = 'flex';
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
        document.getElementById('uploadForm').reset();
        document.getElementById('editVideoId').value = '';
        
        // Reset file upload area
        const uploadContent = document.querySelector('.file-upload-content');
        if (uploadContent) {
            uploadContent.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Click to select video file or drag and drop</p>
                <small>Supported: MP4, WebM, OGG (Max 100MB)</small>
            `;
        }
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
            document.getElementById('uploadForm').classList.add('active');
        }
    }

    async handleYouTubeSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const videoData = {
            videoType: 'youtube',
            videoUrl: formData.get('videoUrl'),
            title: formData.get('title') || '',
            description: formData.get('description') || ''
        };

        const videoId = formData.get('videoId');
        
        try {
            this.showLoading();
            
            let response;
            if (videoId) {
                // Update existing video
                response = await fetch(`/api/video/${videoId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    },
                    body: JSON.stringify({
                        title: videoData.title,
                        description: videoData.description,
                        isActive: formData.get('isActive') === 'on'
                    })
                });
            } else {
                // Create new video
                response = await fetch('/api/video/url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    },
                    body: JSON.stringify(videoData)
                });
            }

            if (response.ok) {
                this.closeVideoModal();
                await this.loadVideos();
                this.showSuccess(videoId ? 'Video updated successfully' : 'Video added successfully');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save video');
            }
        } catch (error) {
            console.error('YouTube submit error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleUploadSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        try {
            this.showLoading();
            
            const response = await fetch('/api/video/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: formData
            });

            if (response.ok) {
                this.closeVideoModal();
                await this.loadVideos();
                this.showSuccess('Video uploaded successfully');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to upload video');
            }
        } catch (error) {
            console.error('Upload submit error:', error);
            alert('Error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    showSuccess(message) {
        // Create a temporary success message
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
}

// Global functions for inline event handlers
let videoManager;

function openAddVideoModal() {
    videoManager.openAddVideoModal();
}

function closeVideoModal() {
    videoManager.closeVideoModal();
}

function closeDeleteModal() {
    videoManager.closeDeleteModal();
}

function switchVideoTab(type) {
    videoManager.switchVideoTab(type);
}

function editVideo(videoId) {
    const video = videoManager.videos.find(v => v._id === videoId);
    if (!video) return;

    document.getElementById('modalTitle').textContent = 'Edit Video';
    document.getElementById('editVideoId').value = videoId;
    
    if (video.videoType === 'youtube') {
        switchVideoTab('youtube');
        document.getElementById('youtubeUrl').value = video.videoUrl;
        document.getElementById('videoTitle').value = video.title || '';
        document.getElementById('videoDescription').value = video.description || '';
        document.getElementById('isActive').checked = video.isActive;
    }
    
    document.getElementById('videoModal').style.display = 'flex';
}

async function toggleVideoStatus(videoId) {
    const video = videoManager.videos.find(v => v._id === videoId);
    if (!video) return;

    try {
        videoManager.showLoading();
        
        const response = await fetch(`/api/video/${videoId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({
                isActive: !video.isActive
            })
        });

        if (response.ok) {
            await videoManager.loadVideos();
            videoManager.showSuccess(`Video ${video.isActive ? 'deactivated' : 'activated'} successfully`);
        } else {
            throw new Error('Failed to update video status');
        }
    } catch (error) {
        console.error('Toggle status error:', error);
        alert('Error: ' + error.message);
    } finally {
        videoManager.hideLoading();
    }
}

function deleteVideo(videoId) {
    videoManager.currentVideoId = videoId;
    document.getElementById('deleteModal').style.display = 'flex';
}

async function confirmDelete() {
    if (!videoManager.currentVideoId) return;

    try {
        videoManager.showLoading();
        
        const response = await fetch(`/api/video/${videoManager.currentVideoId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });

        if (response.ok) {
            videoManager.closeDeleteModal();
            await videoManager.loadVideos();
            videoManager.showSuccess('Video deleted successfully');
        } else {
            throw new Error('Failed to delete video');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error: ' + error.message);
    } finally {
        videoManager.hideLoading();
    }
}

function filterVideos() {
    videoManager.renderVideos();
}

function loadVideos() {
    videoManager.loadVideos();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    videoManager = new VideoManager();
});