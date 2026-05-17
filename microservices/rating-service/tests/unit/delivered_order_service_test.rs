#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use std::sync::Arc;
    
    // Mocks para repo sin DB real
    struct MockDeliveredOrderRepo {
        storage: Arc<std::sync::Mutex<std::collections::HashMap<Uuid, bool>>>,
        insert_calls: Arc<std::sync::Mutex<usize>>,
        conflict_count: usize,
    }
    
    impl MockDeliveredOrderRepo {
        fn new() -> Self {
            Self {
                storage: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
                insert_calls: Arc::new(std::sync::Mutex::new(0)),
                conflict_count: 0,
            }
        }
        
        fn with_existing(pedido_id: Uuid) -> Self {
            let repo = Self::new();
            repo.storage.lock().unwrap().insert(pedido_id, true);
            repo
        }
        
        async fn insert(&mut self, pedido_id: Uuid) -> Result<(), String> {
            let mut storage = self.storage.lock().unwrap();
            if storage.contains_key(&pedido_id) {
                self.conflict_count += 1;
                return Ok(()); // ON CONFLICT DO NOTHING
            }
            storage.insert(pedido_id, true);
            *self.insert_calls.lock().unwrap() += 1;
            Ok(())
        }
        
        async fn exists_by_pedido_id(&self, pedido_id: Uuid) -> Result<bool, String> {
            Ok(self.storage.lock().unwrap().contains_key(&pedido_id))
        }
    }
    
    // Simulación de DeliveredOrderService con mock repo
    struct TestDeliveredOrderService {
        repo: Arc<tokio::sync::Mutex<MockDeliveredOrderRepo>>,
    }
    
    impl TestDeliveredOrderService {
        fn new(repo: MockDeliveredOrderRepo) -> Self {
            Self {
                repo: Arc::new(tokio::sync::Mutex::new(repo)),
            }
        }
        
        async fn register_delivered_order(&self, pedido_id: Uuid) -> Result<(), String> {
            let mut repo = self.repo.lock().await;
            repo.insert(pedido_id).await
        }
        
        async fn is_order_delivered(&self, pedido_id: Uuid) -> Result<bool, String> {
            let repo = self.repo.lock().await;
            repo.exists_by_pedido_id(pedido_id).await
        }
    }

    #[tokio::test]
    async fn test_insert_delivered_order() {
        let repo = MockDeliveredOrderRepo::new();
        let service = TestDeliveredOrderService::new(repo);
        
        let pedido_id = Uuid::new_v4();
        let result = service.register_delivered_order(pedido_id).await;
        
        assert!(result.is_ok());
        assert!(service.is_order_delivered(pedido_id).await.unwrap());
    }

    #[tokio::test]
    async fn test_query_nonexistent_order() {
        let repo = MockDeliveredOrderRepo::new();
        let service = TestDeliveredOrderService::new(repo);
        
        let pedido_id = Uuid::new_v4();
        let exists = service.is_order_delivered(pedido_id).await.unwrap();
        
        assert!(!exists);
    }

    #[tokio::test]
    async fn test_duplicate_insert_ignored_on_conflict() {
        let repo = MockDeliveredOrderRepo::new();
        let service = TestDeliveredOrderService::new(repo);
        
        let pedido_id = Uuid::new_v4();
        let result1 = service.register_delivered_order(pedido_id).await;
        let result2 = service.register_delivered_order(pedido_id).await;
        
        assert!(result1.is_ok());
        assert!(result2.is_ok()); // ON CONFLICT DO NOTHING → no error
        
        let repo = service.repo.lock().await;
        assert_eq!(repo.conflict_count, 1, "Should have 1 conflict (duplicate insert)");
    }

    #[tokio::test]
    async fn test_multiple_distinct_orders() {
        let repo = MockDeliveredOrderRepo::new();
        let service = TestDeliveredOrderService::new(repo);
        
        let pedido_1 = Uuid::new_v4();
        let pedido_2 = Uuid::new_v4();
        let pedido_3 = Uuid::new_v4();
        
        service.register_delivered_order(pedido_1).await.unwrap();
        service.register_delivered_order(pedido_2).await.unwrap();
        service.register_delivered_order(pedido_3).await.unwrap();
        
        assert!(service.is_order_delivered(pedido_1).await.unwrap());
        assert!(service.is_order_delivered(pedido_2).await.unwrap());
        assert!(service.is_order_delivered(pedido_3).await.unwrap());
    }

    #[tokio::test]
    async fn test_pre_populated_order_exists() {
        let repo = MockDeliveredOrderRepo::with_existing(Uuid::new_v4());
        let service = TestDeliveredOrderService::new(repo);
        
        let pedido_id = service.repo.lock().await.storage.lock().unwrap()
            .keys()
            .next()
            .copied()
            .unwrap();
        
        let exists = service.is_order_delivered(pedido_id).await.unwrap();
        assert!(exists);
    }
}
