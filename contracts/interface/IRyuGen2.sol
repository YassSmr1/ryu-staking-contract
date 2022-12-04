// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IRyuGen2 {
    struct Gen2Details {
        uint256 id;
        uint256 incubationTime;
        string uri;
        uint256[2] parents;
    }

    function mint(
        address to,
        uint256 incubationEnd,
        uint256 mintAmount,
        uint256 male,
        uint256 female
    ) external;

    function mintFromLabs(
        address to,
        uint256 twinId,
        bool identical
    ) external;

    function speedUpIncubationTime(uint256 tokenId) external;

    function tokenIdToIncubationEnd(uint256 tokenId)
        external
        view
        returns (uint256);

    function tokenIdToParents(uint256 tokenId, uint256 index)
        external
        view
        returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function walletOfOwner(address owner)
        external
        view returns (Gen2Details[] memory);
}
