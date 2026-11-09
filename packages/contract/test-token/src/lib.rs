use near_contract_standards::fungible_token::metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC};
use near_contract_standards::fungible_token::FungibleToken;
use near_sdk::json_types::U128;
use near_sdk::{env, near, AccountId, PanicOnDefault, PromiseOrValue};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct TestToken { token: FungibleToken, owner: AccountId, symbol: String, decimals: u8 }

#[near]
impl TestToken {
    #[init]
    pub fn new(owner: AccountId, symbol: String, decimals: u8) -> Self {
        let mut token = FungibleToken::new(b"t");
        token.internal_register_account(&owner);
        Self { token, owner, symbol, decimals }
    }
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        assert_eq!(env::predecessor_account_id(), self.owner, "ERR_OWNER");
        if !self.token.accounts.contains_key(&account_id) { self.token.internal_register_account(&account_id); }
        self.token.internal_deposit(&account_id, amount.0);
    }
    pub fn register(&mut self, account_id: AccountId) {
        assert_eq!(env::predecessor_account_id(), self.owner, "ERR_OWNER");
        if !self.token.accounts.contains_key(&account_id) { self.token.internal_register_account(&account_id); }
    }
    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        near_contract_standards::fungible_token::core::FungibleTokenCore::ft_transfer(&mut self.token, receiver_id, amount, memo)
    }
    #[payable]
    pub fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        near_contract_standards::fungible_token::core::FungibleTokenCore::ft_transfer_call(&mut self.token, receiver_id, amount, memo, msg)
    }
    pub fn ft_total_supply(&self) -> U128 {
        near_contract_standards::fungible_token::core::FungibleTokenCore::ft_total_supply(&self.token)
    }
    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        near_contract_standards::fungible_token::core::FungibleTokenCore::ft_balance_of(&self.token, account_id)
    }
    #[private]
    pub fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        near_contract_standards::fungible_token::resolver::FungibleTokenResolver::ft_resolve_transfer(&mut self.token, sender_id, receiver_id, amount)
    }
}

#[near]
impl FungibleTokenMetadataProvider for TestToken {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata { spec: FT_METADATA_SPEC.into(), name: self.symbol.clone(), symbol: self.symbol.clone(),
            icon: None, reference: None, reference_hash: None, decimals: self.decimals }
    }
}
