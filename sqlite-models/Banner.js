const dbAdapter = require('../database-adapter');

class BannerModel {
    constructor(data = {}) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.filename = data.filename;
        this.originalName = data.originalName;
        this.mimeType = data.mimeType;
        this.size = data.size;
        this.image_url = data.image_url;
        this.link_url = data.link_url;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.display_order = data.display_order || 0;
        this.uploadedBy = data.uploadedBy;
        this.created_by = data.created_by;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.mongo_id = data.mongo_id;
        
        this._isNew = !data.id;
    }

    static async findOne(query) {
        const row = await dbAdapter.findOne('banners', query);
        return row ? new BannerModel(row) : null;
    }

    static async find(query = {}, options = {}) {
        const rows = await dbAdapter.find('banners', query, options);
        return rows.map(row => new BannerModel(row));
    }

    static async findById(id) {
        return await BannerModel.findOne({ id });
    }

    async save() {
        const now = new Date().toISOString();
        
        if (this._isNew) {
            this.created_at = now;
            this.updated_at = now;
            
            const data = {
                title: this.title,
                description: this.description,
                filename: this.filename,
                originalName: this.originalName,
                mimeType: this.mimeType,
                size: this.size,
                image_url: this.image_url,
                link_url: this.link_url,
                isActive: this.isActive,
                display_order: this.display_order,
                uploadedBy: this.uploadedBy,
                created_by: this.created_by,
                created_at: this.created_at,
                updated_at: this.updated_at,
                mongo_id: this.mongo_id
            };

            const result = await dbAdapter.insert('banners', data);
            this.id = result.id;
            this._isNew = false;
        } else {
            this.updated_at = now;
            
            const data = {
                title: this.title,
                description: this.description,
                filename: this.filename,
                originalName: this.originalName,
                mimeType: this.mimeType,
                size: this.size,
                image_url: this.image_url,
                link_url: this.link_url,
                isActive: this.isActive,
                display_order: this.display_order,
                uploadedBy: this.uploadedBy,
                created_by: this.created_by,
                updated_at: this.updated_at
            };

            await dbAdapter.update('banners', { id: this.id }, data);
        }
        
        return this;
    }

    async remove() {
        if (this.id) {
            await dbAdapter.delete('banners', { id: this.id });
        }
    }

    get _id() {
        return this.id;
    }

    toJSON() {
        return {
            id: this.id,
            _id: this.id, // For compatibility
            title: this.title,
            description: this.description,
            filename: this.filename,
            originalName: this.originalName,
            mimeType: this.mimeType,
            size: this.size,
            image_url: this.image_url,
            link_url: this.link_url,
            isActive: this.isActive,
            display_order: this.display_order,
            uploadedBy: this.uploadedBy,
            created_by: this.created_by,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = BannerModel;