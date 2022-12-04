// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interface/IRyuGen2.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RyuGen2Staking is IERC721Receiver {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // The address of $nRyu contract
    // Preferable to hardcode the values before deployment
    IERC20 public nRyuToken;

    // The address of Ryusaur contract
    // Preferable to hardcode the values before deployment
    IERC721 public ryusaur;

    // The address of NFT of gen2 contract
    // Preferable to hardcode the values before deployment
    IRyuGen2 public ryuGen2;

    // The treasury address
    // Preferable to hardcode the values before deployment
    address public treasury;

    // A mapping from user to tokenIds staked
    mapping(address => uint256[]) public userToTokenIds;

    // A mapping from tokenId to the staking data struct
    mapping(uint256 => StakingData) public tokenIdToStakingData;

    // A mapping from tokenId to the staking level
    mapping(uint256 => uint256) public tokenIdToLevel;

    // A mapping from tokenId to the staking tier
    mapping(uint256 => uint256) public tokenIdToTier;

    // A mapping from tokenId to boosted count
    mapping(uint256 => uint8) public tokenIdToBoosted;

    // Token id to the number of $nRyu Claimed
    mapping(uint256 => uint256) public tokenIdToClaimed;

    struct StakingData {
        // The address of the staker
        address staker;
        // The RyuGen2 tokenId
        uint16 tokenId;
        // The level start timestamp
        uint32 startTimestamp;
        // The last claiming timestamp
        uint32 claimTimestamp;
        // The index of token in the array of tokens staked by the staker
        uint32 indexInUserToTokenIds;
        // The number of $nRyu claimable ( used to save token earned after upgrading )
        uint256 claimable;
        // Level boosted aka Potion boost
        bool boosted;
        // The ryusaur tokenId => 0 if not boosted
        uint16 ryusaurTokenId;
    }

    // A struct used for viewing staking data and display in the frontend the leaderboard
    struct LeaderboardView {
        // The RyuGen2 Token ID
        uint256 tokenId;
        // The staking level
        uint256 level;
        // The staking tier
        uint256 tier;
    }

    // A struct used for viewing staking data and display in the frontend
    struct StakingDataView {
        // The RyuGen2 Token ID
        uint32 tokenId;
        // The staking level
        uint32 level;
        // The staking tier
        uint32 tier;
        // The timestamp to reach for upgrade
        uint32 upgradeTimestamp;
        // The claimable $nRyu
        uint256 claimable;
        // The levelUp cost in $nRyu
        uint256 levelUpCost;
        // The Earning Per Level in $nRyu
        uint256 earnings;
        // Is staked
        bool staked;
        // Is boosted
        bool boosted;
        // Is Staked
        bool hatched;
        // The ryusaur tokenId => 0 if not boosted
        uint16 ryusaurTokenId;
        // The number of usage of boost potions
        uint16 potionCount;
    }

    constructor(
        address _nRyuToken,
        address _ryusaur,
        address _ryuGen2,
        address _treasury
    ) {
        nRyuToken = IERC20(_nRyuToken);
        ryusaur = IERC721(_ryusaur);
        ryuGen2 = IRyuGen2(_ryuGen2);
        treasury = _treasury;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////   EXTERNAL   ////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Use to stake RyuGen2 NFT's
     * @param tokenIds An array containing the RyuGen2 ID's to stake
     */
    function stake(uint256[] calldata tokenIds)
        external
        onlyGen2Owner(tokenIds)
    {
        uint256 tokenId;
        uint256 index;
        uint256 length = tokenIds.length;
        for (uint256 i = 0; i < length; i++) {
            tokenId = tokenIds[i];
            require(
                block.timestamp >= ryuGen2.tokenIdToIncubationEnd(tokenId),
                "Only on hatched eggs"
            );
            ryuGen2.safeTransferFrom(msg.sender, address(this), tokenId);
            userToTokenIds[msg.sender].push(tokenId);
            index = userToTokenIds[msg.sender].length - 1;
            tokenIdToStakingData[tokenId] = StakingData({
                staker: msg.sender,
                tokenId: uint16(tokenId),
                startTimestamp: uint32(block.timestamp),
                claimTimestamp: uint32(block.timestamp),
                indexInUserToTokenIds: uint32(index),
                claimable: uint256(0),
                boosted: false,
                ryusaurTokenId: uint16(0)
            });
        }
    }

    /**
     * @dev Use to unstake RyuGen2 NFT's
     * @param tokenIds  An array containing the RyuGen2 ID's to unstake
     */
    function unstake(uint256[] calldata tokenIds)
        external
        onlyStakeOwnerBatch(tokenIds)
    {
        uint256 tokenId;
        uint256 length = tokenIds.length;
        for (uint256 i = 0; i < length; i++) {
            tokenId = tokenIds[i];
            StakingData storage stakingData = tokenIdToStakingData[tokenId];
            uint32 ryusaurId = stakingData.ryusaurTokenId;
            _removeTokenId(msg.sender, stakingData.indexInUserToTokenIds);
            _updateClaimable(stakingData);
            uint256 claimable = stakingData.claimable;
            tokenIdToClaimed[stakingData.tokenId] += claimable;
            delete tokenIdToStakingData[tokenId];
            nRyuToken.safeTransfer(msg.sender, claimable);
            ryuGen2.safeTransferFrom(address(this), msg.sender, tokenId);
            if (ryusaurId > 0) {
                ryusaur.safeTransferFrom(address(this), msg.sender, ryusaurId);
            }
        }
    }

    /**
     * @dev Used to retrieve the tokens earned through the NFT's contained in the id's array.
     * @param tokenIds An array containing the RyuGen2 ID's.
     */
    function claim(uint256[] calldata tokenIds)
        external
        onlyStakeOwnerBatch(tokenIds)
    {
        uint256 tokenId;
        uint256 length = tokenIds.length;
        for (uint256 i = 0; i < length; i++) {
            tokenId = tokenIds[i];
            _claim(tokenIdToStakingData[tokenId]);
        }
    }

    /**
     * @dev Upgrade a RyuGen2 to the next level.
     * @param tokenId The RyuGen2 token id to upgrade
     * @param boost true : use boost potion for next level, false : don't use boost potion
     */
    function upgrade(uint256 tokenId, bool boost)
        external
        onlyStakeOwner(tokenId)
    {
        StakingData storage stakingData = tokenIdToStakingData[tokenId];
        uint256 level = tokenIdToLevel[tokenId];
        require(
            _checkUpgradeCondition(
                stakingData.startTimestamp,
                level,
                tokenIdToTier[tokenId]
            ),
            "Cannot upgrade"
        );
        _takeCostAndUpgrade(stakingData, boost);
    }

    /**
     * @dev Add a Ryusaur to boost emission of a staked RyuGen2
     * @param tokenId The RyuGen2 token id to boost
     * @param ryusaurTokenId The Ryusaur token id to use
     */
    function addRyusaur(uint256 tokenId, uint256 ryusaurTokenId)
        external
        onlyStakeOwner(tokenId)
    {
        StakingData storage stakingData = tokenIdToStakingData[tokenId];
        require(
            ryusaur.ownerOf(ryusaurTokenId) == msg.sender,
            "Not owner of ryusaur"
        );
        require(stakingData.ryusaurTokenId == 0, "Already boosted");
        _updateClaimable(stakingData);
        stakingData.ryusaurTokenId = uint16(ryusaurTokenId);
        ryusaur.safeTransferFrom(msg.sender, address(this), ryusaurTokenId);
    }

    /**
     * @dev Remove the Ryusaur which is used to boost the staked RyuGen2
     * @param tokenId The RyuGen2 token id wich is boosted by the Ryusaur
     */
    function removeRyusaur(uint256 tokenId) external onlyStakeOwner(tokenId) {
        StakingData storage stakingData = tokenIdToStakingData[tokenId];
        require(stakingData.ryusaurTokenId != 0, "Not boosted");
        _updateClaimable(stakingData);
        uint256 ryusaurTokenId = stakingData.ryusaurTokenId;
        stakingData.ryusaurTokenId = uint16(0);
        ryusaur.safeTransferFrom(address(this), msg.sender, ryusaurTokenId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////   INTERNAL   ////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Remove the token ID from staking data and update all the indexes
     * @param user The user address
     * @param index The index in the userToTokenIds array
     */
    function _removeTokenId(address user, uint256 index) internal {
        uint256 tokenId = userToTokenIds[user][userToTokenIds[user].length - 1];
        tokenIdToStakingData[tokenId].indexInUserToTokenIds = uint32(index);
        userToTokenIds[user][index] = userToTokenIds[user][
            userToTokenIds[user].length - 1
        ];
        userToTokenIds[user].pop();
    }

    /**
     * @dev Check the upgrade condition bases on the level and the start timestamp
     * @param startTimestamp the start timestamp of the level
     * @param level the level of the token
     * @param tier the tier of the token
     */
    function _checkUpgradeCondition(
        uint256 startTimestamp,
        uint256 level,
        uint256 tier
    ) internal view returns (bool) {
        if (level == 50 && tier == 2) return false;
        else
            return
                level < 51 &&
                block.timestamp >=
                startTimestamp + getDaysRequiredForUpgrade(level);
    }

    /**
     * @dev Check that the token can be upgraded
     * @param stakingData the staking data of the token
     */
    function _upgrade(StakingData storage stakingData) internal {
        if (tokenIdToLevel[stakingData.tokenId] == 50) {
            tokenIdToLevel[stakingData.tokenId] = 0;
            tokenIdToTier[stakingData.tokenId]++;
        } else {
            tokenIdToLevel[stakingData.tokenId]++;
        }
        stakingData.startTimestamp = uint32(block.timestamp);
    }

    /**
     * @dev Take the cost and upgrade the token
     * @param stakingData the staking data of the token
     */
    function _takeCostAndUpgrade(StakingData storage stakingData, bool boost)
        internal
    {
        _updateClaimable(stakingData);
        uint256 cost = getCostRequiredForUpgrade(
            tokenIdToLevel[stakingData.tokenId]
        );
        if (boost) {
            require(
                tokenIdToBoosted[stakingData.tokenId] < 3,
                "No more boost potions"
            );
            tokenIdToBoosted[stakingData.tokenId]++;
            cost += 250 ether;
        }
        stakingData.boosted = boost;
        _upgrade(stakingData);
        if (stakingData.claimable >= cost) {
            stakingData.claimable -= cost;
            tokenIdToClaimed[stakingData.tokenId] += cost;
        } else {
            _splitFunds(cost);
        }
    }

    /**
     * @dev Claim the token earned by the staking data
     * @param stakingData the staking data of the token
     */
    function _claim(StakingData storage stakingData) internal {
        _updateClaimable(stakingData);
        if (stakingData.claimable > 0) {
            uint256 claimable = stakingData.claimable;
            stakingData.claimable = 0;
            tokenIdToClaimed[stakingData.tokenId] += claimable;
            nRyuToken.safeTransfer(stakingData.staker, claimable);
        } else {
            revert("Nothing to claim");
        }
    }

    /**
     * @dev Update the claimable amount and the claim timestamp of the staking data
     * @param stakingData the staking data of the token
     */
    function _updateClaimable(StakingData storage stakingData) internal {
        stakingData.claimable += _getClaimable(stakingData);
        stakingData.claimTimestamp = uint32(block.timestamp);
    }

    /**
     * @dev Get the claimable amount of the staking data
     * @param stakingData the staking data of the token
     */
    function _getClaimable(StakingData storage stakingData)
        internal
        view
        returns (uint256)
    {
        uint256 calculatedReward;
        uint256 emissionCap;
        uint256 result = 0;
        uint256 stakingPeriod = block.timestamp - stakingData.claimTimestamp;
        uint256 divider = 1 days;

        // We get the emission rate of the token and multiply it by the staking period
        uint256 emission = stakingPeriod.mul(
            getEmissionDayPerLevelAndTier(
                tokenIdToLevel[stakingData.tokenId],
                tokenIdToTier[stakingData.tokenId]
            )
        );
        // We boost the emission based on the boost potion used || Ryusaur
        if (stakingData.boosted) {
            emission = emission.mul(125);
            divider = divider.mul(100);
        }
        if (stakingData.ryusaurTokenId > 0) {
            emission = emission.mul(110);
            divider = divider.mul(100);
        }
        calculatedReward = emission.div(divider);

        // We get the emission cap of the token
        emissionCap = getEmissionCapPerLevelAndTier(
            tokenIdToLevel[stakingData.tokenId],
            tokenIdToTier[stakingData.tokenId]
        );

        // If the emission cap is reached, we return the emission cap
        if (
            calculatedReward.add(
                tokenIdToClaimed[stakingData.tokenId] + stakingData.claimable
            ) > emissionCap
        ) {
            result = emissionCap.sub(
                tokenIdToClaimed[stakingData.tokenId] + stakingData.claimable
            );
        } else {
            result = calculatedReward;
        }
        return result;
    }

    /**
     * @dev Get Emission cap value for one level and tier | We use ether as the $nRyu token has 18 decimals
     * @param level The level
     * @param tier The tier
     */
    function _getEmissionCapPerLevelAndTier(uint256 level, uint256 tier)
        internal
        pure
        returns (uint256)
    {
        if (tier == 0) return 1.4729 ether * level + 2.255 ether;
        else if (tier == 1) return 1.67375 ether * level + 4.4375 ether;
        else return 1.84113 ether * level + 8.18125 ether;
    }

    /**
     * @dev Split the funds of the msg.sender between treasury wallet and burning address
     * @param amount The amount to split
     */
    function _splitFunds(uint256 amount) internal {
        uint256 burnedAmount = (amount * 7500) / 10000;
        uint256 treasuryAmount = amount - burnedAmount;
        nRyuToken.safeTransferFrom(msg.sender, address(0xdead), burnedAmount);
        nRyuToken.safeTransferFrom(msg.sender, treasury, treasuryAmount);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////   MODIFIER   ////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Modifier to check if the sender is the owner of the token. By batch.
     * @param tokenIds The tokenIds to check
     */
    modifier onlyGen2Owner(uint256[] calldata tokenIds) {
        uint256 size = tokenIds.length;
        for (uint256 i = 0; i < size; i++) {
            require(
                ryuGen2.ownerOf(tokenIds[i]) == msg.sender,
                "Only the owner can do this"
            );
        }
        _;
    }

    /**
     * @dev Modifier to check if the sender is the staker. By Batch.
     * @param tokenIds The tokenIds to check
     */
    modifier onlyStakeOwnerBatch(uint256[] calldata tokenIds) {
        uint256 size = tokenIds.length;
        for (uint256 i = 0; i < size; i++) {
            require(
                tokenIdToStakingData[tokenIds[i]].staker == msg.sender,
                "Only the stake owner can do this"
            );
        }
        _;
    }

    /**
     * @dev Modifier to check if the sender is the staker
     * @param tokenId The tokenId to check
     */
    modifier onlyStakeOwner(uint256 tokenId) {
        require(
            tokenIdToStakingData[tokenId].staker == msg.sender,
            "Only the stake owner can do this"
        );
        _;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////     VIEW     ////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * @dev Retrieve the StakingDataView for a given user
     * @param user The address of the user
     */
    function stakingDataOfUser(address user)
        external
        view
        returns (StakingDataView[] memory)
    {
        uint256 i = 0;
        IRyuGen2.Gen2Details[] memory unstakedNfts = ryuGen2.walletOfOwner(user);
        uint256 size = userToTokenIds[user].length + unstakedNfts.length;
        StakingDataView[] memory result = new StakingDataView[](size);
        uint256 max = userToTokenIds[user].length;
        for (i; i < max; i++) {
            StakingData memory stakingData = tokenIdToStakingData[
                userToTokenIds[user][i]
            ];
            uint32 level = uint32(tokenIdToLevel[stakingData.tokenId]);
            result[i] = StakingDataView({
                tokenId: stakingData.tokenId,
                level: level,
                tier: uint32(tokenIdToTier[stakingData.tokenId]),
                claimable: getClaimable(stakingData.tokenId),
                staked: true,
                hatched: true,
                upgradeTimestamp: uint32(stakingData.startTimestamp + getDaysRequiredForUpgrade(level)),
                earnings: getEmissionDayPerLevelAndTier(
                    tokenIdToLevel[stakingData.tokenId],
                    tokenIdToTier[stakingData.tokenId]
                ),
                levelUpCost: getCostRequiredForUpgrade(level),
                boosted: stakingData.boosted,
                ryusaurTokenId: stakingData.ryusaurTokenId,
                potionCount: 3 - tokenIdToBoosted[stakingData.tokenId]
            });
        }

        for (i; i < size; i++) {
            uint256 tokenId = unstakedNfts[i - max].id;
            uint32 level = uint32(tokenIdToLevel[tokenId]);
            result[i] = StakingDataView({
                tokenId: uint32(tokenId),
                level: level,
                tier: uint32(tokenIdToTier[tokenId]),
                claimable: getClaimable(tokenId),
                staked: false,
                upgradeTimestamp: 0,
                earnings: getEmissionDayPerLevelAndTier(
                    tokenIdToLevel[tokenId],
                    tokenIdToTier[tokenId]
                ),
                hatched: block.timestamp >= ryuGen2.tokenIdToIncubationEnd(tokenId),
                levelUpCost: getCostRequiredForUpgrade(level),
                boosted: false,
                ryusaurTokenId: 0,
                potionCount: 3 - tokenIdToBoosted[tokenId]
            });
        }

        return result;
    }

    /**
     * @dev Retrieve the days that the user have to wait before upgrade
     * @param level The level
     */
    function getDaysRequiredForUpgrade(uint256 level)
        public
        pure
        returns (uint256)
    {
        if (level < 5) return 3 days;
        else if (level >= 5 && level < 20) return 4 days;
        else if (level >= 20 && level < 32) return 5 days;
        else return 6 days;
    }

    /**
     * @dev Retrieve the cost the user need to pay to upgrade | We use ether as the $nRyu token has 18 decimals
     * @param level The level
     */
    function getCostRequiredForUpgrade(uint256 level)
        public
        pure
        returns (uint256)
    {
        return 1.339 ether * level + 2.05 ether;
    }

    /**
     * @dev Get Emission cap per level and tier for a given level and tier
     * @param level The level
     * @param tier The tier
     */
    function getEmissionCapPerLevelAndTier(uint256 level, uint256 tier)
        public
        pure
        returns (uint256)
    {
        uint256 somme = 0;
        uint256 realLevel = level + (50 * tier) + tier;
        uint256 i = 0;
        for (uint256 j = 0; j <= realLevel; j++) {
            somme += _getEmissionCapPerLevelAndTier(j % 51, i);
            if (j == 50 || j == 101) i++;
        }
        return somme;
    }

    /**
     * @dev Get Emission Day | We use ether as the $nRyu token has 18 decimals
     * @param level The level
     * @param tier The tier
     */
    function getEmissionDayPerLevelAndTier(uint256 level, uint256 tier)
        public
        pure
        returns (uint256)
    {
        if (tier == 0) return 0.216334 ether * level + 0.6833 ether;
        else if (tier == 1) return 0.216334 ether * level + 2.1833 ether;
        else return 0.216334 ether * level + 3.6833 ether;
    }

    /**
     * @dev Get the total amount of tokens the RyuGen2 can claim
     * @param tokenId The token Id to check
     */
    function getClaimable(uint256 tokenId) public view returns (uint256) {
        StakingData storage stakingData = tokenIdToStakingData[tokenId];
        if (stakingData.startTimestamp == 0) return 0;
        return
            _getClaimable(stakingData) +
            stakingData.claimable;
    }

    /**
     * @dev Get all the level and tier from tokenId between `from` and `to` -1
     * @param from The starting index
     * @param to The ending index - 1
     */
     function getLevelAndRankInRange(uint256 from, uint256 to) public view returns (LeaderboardView[] memory) {
        uint256 size = to - from;
        LeaderboardView[] memory result = new LeaderboardView[](size);
        for (uint256 i = from; i < to; i++) {
            result[i - from] = LeaderboardView({
                tokenId: i,
                level: tokenIdToLevel[i],
                tier: tokenIdToTier[i]
            });
        }
        return result;
     }
}
