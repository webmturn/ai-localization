        // 工具函数：获取状态文本
        function getStatusText(status) {
            switch (status) {
                case 'translated': return '已翻译';
                case 'edited': return '已编辑';
                case 'approved': return '已批准';
                case 'pending': return '待翻译';
                default: return status;
            }
        }
        
