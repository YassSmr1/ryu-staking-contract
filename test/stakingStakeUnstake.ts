import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  MockErc20,
  MockGen1,
  MockRyusaur,
  MockGen2,
  RyuGen2Staking,
} from "../typechain";

describe("Staking : Stake, Unstake", function () {
  let mockErc20: MockErc20,
    mockGen1: MockGen1,
    mockRyusaur: MockRyusaur,
    mockGen2: MockGen2,
    stakingGen2: RyuGen2Staking;
  let owner: SignerWithAddress, user1: SignerWithAddress;
  let gen2tokenUser1: number[];
  const treasury = "0xa99FDc265b180FAED22C9219e65f0D1D79A570B5";

  beforeEach(async () => {
    [owner, user1] = await ethers.getSigners();

    const MockErc20 = await ethers.getContractFactory("MockErc20");
    mockErc20 = await MockErc20.deploy();
    await mockErc20.deployed();

    const MockGen1 = await ethers.getContractFactory("MockGen1");
    mockGen1 = await MockGen1.deploy();
    await mockGen1.deployed();

    const MockRyusaur = await ethers.getContractFactory("MockRyusaur");
    mockRyusaur = await MockRyusaur.deploy();
    await mockRyusaur.deployed();

    const MockGen2 = await ethers.getContractFactory("MockGen2");
    mockGen2 = await MockGen2.deploy();
    await mockGen2.deployed();

    const StakingGen2 = await ethers.getContractFactory("RyuGen2Staking");
    stakingGen2 = await StakingGen2.deploy(
      mockErc20.address,
      mockRyusaur.address,
      mockGen2.address,
      treasury
    );

    await mockGen1.connect(owner).mint(2);
    await mockGen1.connect(user1).mint(5);
    await mockRyusaur.connect(user1).mint(5);

    await mockErc20
      .connect(owner)
      .approve(stakingGen2.address, ethers.constants.MaxUint256);
    await mockErc20
      .connect(user1)
      .approve(stakingGen2.address, ethers.constants.MaxUint256);

    await mockErc20
      .connect(owner)
      .transfer(user1.address, ethers.utils.parseEther("200000"));

    await mockErc20
      .connect(owner)
      .transfer(stakingGen2.address, ethers.utils.parseEther("200000"));

    await mockGen2.connect(user1).setApprovalForAll(stakingGen2.address, true);
    await mockRyusaur
      .connect(user1)
      .setApprovalForAll(stakingGen2.address, true);

    gen2tokenUser1 = [2, 3, 4, 5, 6];

    await mockGen2.connect(owner).mint(1);
    await mockGen2.connect(user1).mint(4);
    await ethers.provider.send("evm_increaseTime", [33 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);
    await mockGen2.connect(user1).mint(1);
  });

  it("I can stake my gen2 nft", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    const stakingData = await stakingGen2.stakingDataOfUser(user1.address);
    expect(stakingData.length).to.equal(5);
    expect(stakingData[0].tokenId).to.equal(gen2tokenUser1[0]);
    expect(stakingData[0].level).to.equal(0);
  });

  it("I can stake multiple gen2 nft", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).stake([gen2tokenUser1[1]]);
    const stakingData = await stakingGen2.stakingDataOfUser(user1.address);
    expect(stakingData.length).to.equal(5);
    expect(stakingData[0].tokenId).to.equal(gen2tokenUser1[0]);
    expect(stakingData[0].level).to.equal(0);
    expect(stakingData[1].tokenId).to.equal(gen2tokenUser1[1]);
    expect(stakingData[1].level).to.equal(0);
  });

  it("I can unstake", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).unstake([gen2tokenUser1[0]]);
    const stakingData = await stakingGen2.stakingDataOfUser(user1.address);
    expect(stakingData.length).to.equal(5);
  });

  it("Should revert if i try to stake a token that i dont own", async function () {
    await expect(
      stakingGen2.connect(owner).stake([gen2tokenUser1[0]])
    ).to.be.revertedWith("Only the owner can do this");
  });

  it("Should revert if i try to stake a token that is not hatched", async function () {
    await expect(
      stakingGen2.connect(user1).stake([gen2tokenUser1[4]])
    ).to.be.revertedWith("Only on hatched eggs");
  });

  it("Should revert if i try to upgrade a token that i dont own | onlyStakeOwner", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      stakingGen2.connect(owner).upgrade(gen2tokenUser1[0], false)
    ).to.be.revertedWith("Only the stake owner can do this");
  });

  it("Should revert if i try to unstake a token that i dont own | onlyStakeOwnerBatch", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      stakingGen2.connect(owner).unstake([gen2tokenUser1[0]])
    ).to.be.revertedWith("Only the stake owner can do this");
  });

  it("If i remove an nft from staking his index should change", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).stake([gen2tokenUser1[1]]);
    await stakingGen2.connect(user1).unstake([gen2tokenUser1[0]]);
    const stakingData = await stakingGen2.stakingDataOfUser(user1.address);
    expect(stakingData[0].tokenId).to.equal(gen2tokenUser1[1]);
    expect(stakingData[0].level).to.equal(0);
  });

  it("It should save nft level even if i unstake", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    await stakingGen2.connect(user1).unstake([gen2tokenUser1[0]]);
    expect(await stakingGen2.tokenIdToLevel(gen2tokenUser1[0])).to.equal(1);
  });

  it("When i stake i should give my nft to the contract", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    expect(await mockGen2.ownerOf(gen2tokenUser1[0])).to.equal(
      stakingGen2.address
    );
  });

  it("When i unstake i should get my nft back", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).unstake([gen2tokenUser1[0]]);
    expect(await mockGen2.ownerOf(gen2tokenUser1[0])).to.equal(user1.address);
  });

  it("When i add a ryusaur i should give it to the contract", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 1);
    expect(await mockRyusaur.ownerOf(1)).to.equal(stakingGen2.address);
  });

  it("When i remove a ryusaur i should get it back", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 1);
    await stakingGen2.connect(user1).removeRyusaur(gen2tokenUser1[0]);
    expect(await mockRyusaur.ownerOf(1)).to.equal(user1.address);
  });

  it("When i unstake an nft i should get back my ryusaur", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 1);
    await stakingGen2.connect(user1).unstake([gen2tokenUser1[0]]);
    expect(await mockRyusaur.ownerOf(1)).to.equal(user1.address);
  });
});
