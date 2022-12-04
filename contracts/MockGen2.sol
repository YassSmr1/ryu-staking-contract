// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockGen2 is ERC721Enumerable, Ownable {
    using Strings for uint256;
    string public baseURI;
    // The tokenId to Parents Id
    mapping(uint256 => uint256[2]) public tokenIdToParents;

    struct Gen2Details {
        uint256 id;
        uint256 incubationTime;
        string uri;
        uint256[2] parents;
    }

    // The tokenId to the timestamp of incubation end
    mapping(uint256 => uint256) public tokenIdToIncubationEnd;

    constructor() ERC721("RyuGen2", "RYU2") {
        baseURI = "https://ipfs.io/ipfs/QmShG5SvTx4bkUNTpVNwQKkEMhcyM5SmbfQSTGy7sZ9L9S/";
    }

    function mint(uint256 _mintAmount) public payable {
        uint256 supply = totalSupply();
        for (uint256 i = 1; i <= _mintAmount; i++) {
            tokenIdToIncubationEnd[supply + i] = block.timestamp + 33 days;
            tokenIdToParents[supply + i] = [0, 0];
            _safeMint(msg.sender, supply + i);
        }
    }

    /**
     * @dev Return all the nft's of _user
     * @param user The user to get the nft's of
     */
    function walletOfOwner(address user)
        external
        view
        returns (Gen2Details[] memory)
    {
        uint256 ownerTokenCount = balanceOf(user);
        Gen2Details[] memory details = new Gen2Details[](ownerTokenCount);
        for (uint256 i = 0; i < ownerTokenCount; i++) {
            uint256 id = tokenOfOwnerByIndex(user, i);
            details[i] = Gen2Details({
                id: id,
                incubationTime: tokenIdToIncubationEnd[id],
                uri: tokenURI(id),
                parents: tokenIdToParents[id]
            });
        }
        return details;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_exists(tokenId), "URI query for nonexistent token");

        return
            string(abi.encodePacked(_baseURI(), tokenId.toString(), ".json"));
    }

    function isLegend(uint256 nftId) external pure returns (bool) {
        if (nftId == 2 || nftId == 3) {
            return true;
        } else {
            return false;
        }
    }
}
