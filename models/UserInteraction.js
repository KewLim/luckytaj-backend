const mongoose = require('mongoose');

// User Interaction Metrics Schema
const userInteractionSchema = new mongoose.Schema({
    // Tip Information
    tipId: {
        type: String,
        required: true,
        index: true
    },
    
    // User/Session Information
    sessionId: {
        type: String,
        index: true
    },
    userId: {
        type: String,
        index: true
    },
    phoneNumber: {
        type: String,
        index: true,
        sparse: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    
    // Interaction Type
    interactionType: {
        type: String,
        enum: ['view', 'click', 'time_spent'],
        required: true,
        index: true
    },
    
    // Device Information
    deviceInfo: {
        deviceType: {
            type: String,
            enum: ['mobile', 'desktop', 'tablet'],
            required: true
        },
        os: String,
        browser: String,
        userAgent: String
    },
    
    // Time Data
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    timeSpentMs: {
        type: Number,
        min: 0
    },
    
    // Click Data
    clickUrl: String,
    clickTarget: String,
    
    // Additional Metadata
    referrer: String,
    pageUrl: String,
    
    // Aggregation helper fields
    date: {
        type: String,
        index: true
    },
    hour: {
        type: Number,
        min: 0,
        max: 23
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
userInteractionSchema.index({ tipId: 1, date: 1 });
userInteractionSchema.index({ interactionType: 1, timestamp: -1 });
userInteractionSchema.index({ sessionId: 1, tipId: 1, date: 1 });
userInteractionSchema.index({ 'deviceInfo.deviceType': 1, date: 1 });

// Pre-save middleware to set date and hour
userInteractionSchema.pre('save', function(next) {
    if (this.timestamp) {
        const date = new Date(this.timestamp);
        this.date = date.toISOString().split('T')[0]; // YYYY-MM-DD
        this.hour = date.getHours();
    }
    next();
});

// Static methods for metrics aggregation
userInteractionSchema.statics.getTotalViews = async function(startDate, endDate) {
    const match = {
        interactionType: 'view',
        timestamp: {
            $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
            $lte: endDate || new Date()
        }
    };
    
    return await this.countDocuments(match);
};

userInteractionSchema.statics.getUniqueVisitors = async function(startDate, endDate) {
    const match = {
        interactionType: 'view',
        timestamp: {
            $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
            $lte: endDate || new Date()
        }
    };
    
    const pipeline = [
        { $match: match },
        {
            $group: {
                _id: { sessionId: '$sessionId', tipId: '$tipId', date: '$date' },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: null,
                uniqueVisitors: { $sum: 1 }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    return result[0]?.uniqueVisitors || 0;
};

userInteractionSchema.statics.getClickThroughRate = async function(startDate, endDate) {
    const dateRange = {
        $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
        $lte: endDate || new Date()
    };
    
    // Calculate CTR per user (sessionId) then average across all users
    const pipeline = [
        {
            $match: {
                timestamp: dateRange,
                interactionType: { $in: ['view', 'click'] }
            }
        },
        {
            $group: {
                _id: {
                    sessionId: '$sessionId',
                    tipId: '$tipId',
                    interactionType: '$interactionType'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: {
                    sessionId: '$_id.sessionId',
                    tipId: '$_id.tipId'
                },
                views: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.interactionType', 'view'] }, '$count', 0]
                    }
                },
                clicks: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.interactionType', 'click'] }, '$count', 0]
                    }
                }
            }
        },
        {
            $project: {
                ctr: {
                    $cond: [
                        { $gt: ['$views', 0] },
                        { $multiply: [{ $divide: ['$clicks', '$views'] }, 100] },
                        0
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                avgCTR: { $avg: '$ctr' },
                userCount: { $sum: 1 }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    return result[0]?.avgCTR || 0;
};

userInteractionSchema.statics.getAverageTimeOnPage = async function(startDate, endDate) {
    const match = {
        interactionType: 'time_spent',
        timeSpentMs: { $gt: 0 },
        timestamp: {
            $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
            $lte: endDate || new Date()
        }
    };
    
    const pipeline = [
        { $match: match },
        {
            $group: {
                _id: null,
                avgTime: { $avg: '$timeSpentMs' }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    const avgMs = result[0]?.avgTime || 0;
    return Math.round(avgMs / 1000); // Convert to seconds
};

userInteractionSchema.statics.getDeviceDistribution = async function(startDate, endDate) {
    const match = {
        interactionType: 'view',
        timestamp: {
            $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
            $lte: endDate || new Date()
        }
    };
    
    const pipeline = [
        { $match: match },
        {
            $group: {
                _id: '$deviceInfo.deviceType',
                count: { $sum: 1 }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    const total = result.reduce((sum, item) => sum + item.count, 0);
    
    const distribution = {};
    result.forEach(item => {
        distribution[item._id] = {
            count: item.count,
            percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : 0
        };
    });
    
    return distribution;
};

userInteractionSchema.statics.getTipPerformance = async function(startDate, endDate) {
    const dateRange = {
        $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
        $lte: endDate || new Date()
    };
    
    const pipeline = [
        {
            $match: {
                timestamp: dateRange
            }
        },
        {
            $group: {
                _id: {
                    tipId: '$tipId',
                    interactionType: '$interactionType'
                },
                count: { $sum: 1 },
                avgTime: { $avg: '$timeSpentMs' }
            }
        },
        {
            $group: {
                _id: '$_id.tipId',
                views: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.interactionType', 'view'] }, '$count', 0]
                    }
                },
                clicks: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.interactionType', 'click'] }, '$count', 0]
                    }
                },
                avgTimeMs: {
                    $avg: {
                        $cond: [{ $eq: ['$_id.interactionType', 'time_spent'] }, '$avgTime', null]
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'userinteractions',
                let: { currentTipId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$tipId', '$$currentTipId'] },
                            phoneNumber: { $exists: true, $ne: null, $ne: '' }
                        }
                    },
                    {
                        $group: {
                            _id: '$phoneNumber',
                            count: { $sum: 1 },
                            lastSeen: { $max: '$timestamp' }
                        }
                    },
                    { $sort: { lastSeen: -1, count: -1 } },
                    { $limit: 1 }
                ],
                as: 'phoneInfo'
            }
        },
        {
            $lookup: {
                from: 'userinteractions',
                let: { currentTipId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$tipId', '$$currentTipId'] },
                            timestamp: {
                                $gte: startDate,
                                $lte: endDate
                            }
                        }
                    },
                    { $sort: { timestamp: -1 } },
                    { $limit: 1 }
                ],
                as: 'lastActivity'
            }
        },
        {
            $project: {
                tipId: '$_id',
                displayId: {
                    $cond: [
                        { $gt: [{ $size: '$phoneInfo' }, 0] },
                        { $arrayElemAt: ['$phoneInfo._id', 0] },
                        '$_id'
                    ]
                },
                views: 1,
                clicks: 1,
                ctr: {
                    $round: [
                        {
                            $cond: [
                                { $gt: ['$views', 0] },
                                { $multiply: [{ $divide: ['$clicks', '$views'] }, 100] },
                                0
                            ]
                        },
                        0
                    ]
                },
                avgTimeSeconds: {
                    $round: [{ $divide: ['$avgTimeMs', 1000] }, 0]
                },
                lastActivityTime: {
                    $cond: [
                        { $gt: [{ $size: '$lastActivity' }, 0] },
                        { $arrayElemAt: ['$lastActivity.timestamp', 0] },
                        new Date(0) // Default to epoch if no activity
                    ]
                }
            }
        },
        { $sort: { lastActivityTime: -1 } }
    ];
    
    return await this.aggregate(pipeline);
};

userInteractionSchema.statics.getMetricsTrend = async function(days = 7) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    
    const pipeline = [
        {
            $match: {
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    date: '$date',
                    interactionType: '$interactionType'
                },
                count: { $sum: 1 },
                avgTime: { $avg: '$timeSpentMs' }
            }
        },
        {
            $group: {
                _id: '$_id.date',
                views: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.interactionType', 'view'] }, '$count', 0]
                    }
                },
                clicks: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.interactionType', 'click'] }, '$count', 0]
                    }
                },
                avgTimeMs: {
                    $avg: {
                        $cond: [{ $eq: ['$_id.interactionType', 'time_spent'] }, '$avgTime', null]
                    }
                }
            }
        },
        { $sort: { _id: 1 } }
    ];
    
    return await this.aggregate(pipeline);
};

module.exports = mongoose.model('UserInteraction', userInteractionSchema);