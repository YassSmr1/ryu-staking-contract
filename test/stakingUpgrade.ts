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

describe("Staking : Upgrade", function () {
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

  it("Should revert if i dont wait 3 days before upgrading to lvl 1", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await expect(
      stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false)
    ).to.be.revertedWith("Cannot upgrade");
  });

  it("Should upgrade to level 1 if i waited time", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    const stakingData = await stakingGen2
      .connect(user1)
      .stakingDataOfUser(user1.address);
    expect(stakingData[0].tokenId).to.be.equal(gen2tokenUser1[0]);
    expect(stakingData[0].level).to.be.equal(1);
    expect(
      await stakingGen2.connect(user1).tokenIdToTier(gen2tokenUser1[0])
    ).to.be.equal(0);
  });

  it("Should get me level 1 tier 0 when calling getLevelAndRank", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    const levelAndRank = await stakingGen2.getLevelAndRankInRange(0, 10);
    expect(levelAndRank[2].level).to.be.equal(1);
    expect(levelAndRank[2].tier).to.be.equal(0);
  });

  it("Upgrade should send 75% of the cost to a burn address, and 25 to treasury", async function () {
    const balanceBeforeTreasury = await mockErc20.balanceOf(treasury);
    const balanceBeforeBurn = await mockErc20.balanceOf(
      "0x000000000000000000000000000000000000dEaD"
    );
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], true);
    const balanceAfterTreasury = await mockErc20.balanceOf(treasury);
    const balanceAfterBurn = await mockErc20.balanceOf(
      "0x000000000000000000000000000000000000dEaD"
    );
    expect(balanceAfterTreasury.sub(balanceBeforeTreasury)).to.be.equal(
      ethers.utils.parseEther("63.0125")
    );
    expect(balanceAfterBurn.sub(balanceBeforeBurn)).to.be.equal(
      ethers.utils.parseEther("189.0375")
    );
  });

  it("Should revert if i try to ugprade after another one", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    await expect(
      stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false)
    ).to.be.revertedWith("Cannot upgrade");
  });

  it("Should upgrade tier after 51 lvl up", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    for (let i = 0; i < 51; i++) {
      await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]);
      await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    }
    const stakingData = await stakingGen2
      .connect(user1)
      .stakingDataOfUser(user1.address);
    expect(stakingData[0].tokenId).to.be.equal(gen2tokenUser1[0]);
    expect(stakingData[0].level).to.be.equal(0);
    expect(
      await stakingGen2.connect(user1).tokenIdToTier(gen2tokenUser1[0])
    ).to.be.equal(1);
  });

  it("Should have a maximum of tier 3", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    for (let i = 0; i < 152; i++) {
      await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]);
      await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    }
    await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]);
    await expect(
      stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false)
    ).to.be.revertedWith("Cannot upgrade");
  });
});
