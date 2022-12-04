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

describe("Staking : Boost", function () {
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
    await mockRyusaur.connect(owner).mint(1);

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

  it("Boosted token can't overtake the emission cap", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    expect(
      await stakingGen2.connect(user1).getClaimable(gen2tokenUser1[0])
    ).to.equal(ethers.utils.parseEther("5.9829"));
  });

  it("Boosted token with ryusaur should earn 10% more tokens", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 1);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    expect(
      await stakingGen2.connect(user1).getClaimable(gen2tokenUser1[0])
    ).to.equal(ethers.utils.parseEther("1.43493"));
  });

  it("Boosted level 1 should earn 25% more tokens", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    expect(
      await stakingGen2.connect(user1).getClaimable(gen2tokenUser1[0])
    ).to.equal(ethers.utils.parseEther("3.3795425"));
  });

  it("Boosted token with ryusaur and boost potion should earn 35% more tokens", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 1);
    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    expect(
      await stakingGen2.connect(user1).getClaimable(gen2tokenUser1[0])
    ).to.equal(ethers.utils.parseEther("4.61653925"));
  });

  it("Boost should be removed after upgrading", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    expect(
      (await stakingGen2.tokenIdToStakingData(gen2tokenUser1[0])).boosted
    ).to.equal(false);
  });

  it("Boosted should be removed after upgrading without using it and emission back at normal", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    expect(
      await stakingGen2.connect(user1).getClaimable(gen2tokenUser1[0])
    ).to.equal(ethers.utils.parseEther("3.709868"));
  });

  it("Max 3 level boosted", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]);
    await expect(
      stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true)
    ).to.be.revertedWith("No more boost potions");
  });

  it("Should revert if i dont own the ryusaur used to boost", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await expect(
      stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 6)
    ).to.be.revertedWith("Not owner of ryusaur");
  });

  it("Should revert if already added a ryusaur to boost my staking", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 1);
    await expect(
      stakingGen2.connect(user1).addRyusaur(gen2tokenUser1[0], 2)
    ).to.be.revertedWith("Already boosted");
  });

  it("Should revert if i try to remove a ryusaur when there is no one added", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await expect(
      stakingGen2.connect(user1).removeRyusaur(gen2tokenUser1[0])
    ).to.be.revertedWith("Not boosted");
  });
});
