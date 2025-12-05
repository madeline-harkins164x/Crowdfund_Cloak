pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract CrowdfundCloakFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchClosed();
    error InvalidArgument();
    error ReplayDetected();
    error StateMismatch();
    error InvalidProof();
    error BatchNotClosed();
    error BatchAlreadyClosed();
    error BatchNotOpen();
    error InvalidBatchId();

    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PausedContract(address indexed account);
    event UnpausedContract(address indexed account);
    event CooldownSecondsChanged(uint256 oldCooldownSeconds, uint256 newCooldownSeconds);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event ContributionSubmitted(address indexed contributor, uint256 indexed batchId, bytes32 encryptedAmount);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 totalAmount);

    address public owner;
    mapping(address => bool) public providers;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    struct Batch {
        bool exists;
        bool closed;
        euint32 encryptedTotalAmount;
        uint256 contributionCount;
    }
    mapping(uint256 => Batch) public batches;
    uint256 public currentBatchId;
    uint256 public nextBatchId = 1;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier submissionCooldown(address _address) {
        if (block.timestamp < lastSubmissionTime[_address] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier decryptionRequestCooldown(address _address) {
        if (block.timestamp < lastDecryptionRequestTime[_address] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        providers[owner] = true;
        currentBatchId = nextBatchId;
        batches[currentBatchId] = Batch({ exists: true, closed: false, encryptedTotalAmount: FHE.asEuint32(0), contributionCount: 0 });
        emit BatchOpened(currentBatchId);
    }

    function changeOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidArgument();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnerChanged(oldOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        if (provider == address(0)) revert InvalidArgument();
        providers[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        if (provider == address(0)) revert InvalidArgument();
        delete providers[provider];
        emit ProviderRemoved(provider);
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit PausedContract(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit UnpausedContract(msg.sender);
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) external onlyOwner {
        uint256 oldCooldownSeconds = cooldownSeconds;
        cooldownSeconds = newCooldownSeconds;
        emit CooldownSecondsChanged(oldCooldownSeconds, newCooldownSeconds);
    }

    function openNewBatch() external onlyOwner whenNotPaused {
        if (!batches[currentBatchId].closed) revert BatchNotClosed();
        currentBatchId = nextBatchId++;
        batches[currentBatchId] = Batch({ exists: true, closed: false, encryptedTotalAmount: FHE.asEuint32(0), contributionCount: 0 });
        emit BatchOpened(currentBatchId);
    }

    function closeCurrentBatch() external onlyOwner whenNotPaused {
        if (batches[currentBatchId].closed) revert BatchAlreadyClosed();
        batches[currentBatchId].closed = true;
        emit BatchClosed(currentBatchId);
    }

    function submitContribution(euint32 encryptedAmount) external onlyProvider whenNotPaused submissionCooldown(msg.sender) {
        if (!batches[currentBatchId].exists) revert InvalidBatchId();
        if (batches[currentBatchId].closed) revert BatchClosed();

        lastSubmissionTime[msg.sender] = block.timestamp;
        batches[currentBatchId].encryptedTotalAmount = FHE.add(batches[currentBatchId].encryptedTotalAmount, encryptedAmount);
        batches[currentBatchId].contributionCount++;
        emit ContributionSubmitted(msg.sender, currentBatchId, FHE.toBytes32(encryptedAmount));
    }

    function requestBatchTotalDecryption(uint256 batchId) external onlyProvider whenNotPaused decryptionRequestCooldown(msg.sender) {
        if (!batches[batchId].exists) revert InvalidBatchId();
        if (!batches[batchId].closed) revert BatchNotClosed();

        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        euint32[] memory cts = new euint32[](1);
        cts[0] = batches[batchId].encryptedTotalAmount;
        bytes32 stateHash = keccak256(abi.encode(cts, address(this)));
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({ batchId: batchId, stateHash: stateHash, processed: false });
        emit DecryptionRequested(requestId, batchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        if (decryptionContexts[requestId].processed) revert ReplayDetected();

        uint256 batchId = decryptionContexts[requestId].batchId;
        if (!batches[batchId].exists) revert InvalidBatchId();

        euint32[] memory cts = new euint32[](1);
        cts[0] = batches[batchId].encryptedTotalAmount;
        bytes32 currentHash = keccak256(abi.encode(cts, address(this)));
        if (currentHash != decryptionContexts[requestId].stateHash) {
            revert StateMismatch();
        }

        if (!FHE.checkSignatures(requestId, cleartexts, proof)) {
            revert InvalidProof();
        }

        uint256 totalAmount = abi.decode(cleartexts, (uint256));
        decryptionContexts[requestId].processed = true;
        emit DecryptionCompleted(requestId, batchId, totalAmount);
    }

    function _hashCiphertexts(euint32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded(euint32 storage encryptedVar, uint32 initialValue) internal {
        if (!FHE.isInitialized(encryptedVar)) {
            encryptedVar = FHE.asEuint32(initialValue);
        }
    }

    function _requireInitialized(euint32 encryptedVar) internal view {
        if (!FHE.isInitialized(encryptedVar)) {
            revert("FHE: Variable not initialized");
        }
    }
}