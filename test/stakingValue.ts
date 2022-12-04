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

describe("Staking : Value", function () {
  let mockErc20: MockErc20,
    mockGen1: MockGen1,
    mockRyusaur: MockRyusaur,
    mockGen2: MockGen2,
    stakingGen2: RyuGen2Staking;
  let owner: SignerWithAddress, user1: SignerWithAddress;
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

    await mockGen2.connect(owner).mint(1);
    await mockGen2.connect(user1).mint(4);
    await ethers.provider.send("evm_increaseTime", [33 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);
    await mockGen2.connect(user1).mint(1);
  });

  it("Should require 3 days to upgrade to lvl 1", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(0)).to.equal(
      24 * 60 * 60 * 3
    );
  });

  it("Should require 3 days to upgrade to lvl 5", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(4)).to.equal(
      24 * 60 * 60 * 3
    );
  });

  it("Should require 4 days to upgrade to lvl 6", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(5)).to.equal(
      24 * 60 * 60 * 4
    );
  });

  it("Should require 4 days to upgrade to lvl 20", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(19)).to.equal(
      24 * 60 * 60 * 4
    );
  });

  it("Should require 5 days to upgrade to lvl 21", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(20)).to.equal(
      24 * 60 * 60 * 5
    );
  });

  it("Should require 5 days to upgrade to lvl 32", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(31)).to.equal(
      24 * 60 * 60 * 5
    );
  });

  it("Should require 6 days to upgrade to lvl 33", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(32)).to.equal(
      24 * 60 * 60 * 6
    );
  });

  it("Should require 6 days to upgrade to lvl 47", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(46)).to.equal(
      24 * 60 * 60 * 6
    );
  });

  it("Tier 2 : Should require 6 days to upgrade to lvl 0", async function () {
    expect(await stakingGen2.getDaysRequiredForUpgrade(50)).to.equal(
      24 * 60 * 60 * 6
    );
  });

  it("Should require 69 $nRYU to upgrade at last level", async function () {
    expect(await stakingGen2.getCostRequiredForUpgrade(50)).to.equal(
      ethers.utils.parseEther("69")
    );
  });

  it("Should have emission cap of 2.255 $nRyu at level 0 tier 1", async function () {
    expect(await stakingGen2.getEmissionCapPerLevelAndTier(0, 0)).to.equal(
      ethers.utils.parseEther("2.255")
    );
  });

  it("Should have emission cap of 1992.9525 $nRyu at level 50 tier 1", async function () {
    expect(await stakingGen2.getEmissionCapPerLevelAndTier(50, 0)).to.equal(
      ethers.utils.parseEther("1992.9525")
    );
  });

  it("Should have emission cap of 1997.39 $nRyu at level 0 tier 2", async function () {
    expect(await stakingGen2.getEmissionCapPerLevelAndTier(0, 1)).to.equal(
      ethers.utils.parseEther("1997.39")
    );
  });

  it("Should have emission cap of 4353.29625 $nRyu at level 50 tier 2", async function () {
    expect(await stakingGen2.getEmissionCapPerLevelAndTier(50, 1)).to.equal(
      ethers.utils.parseEther("4353.29625")
    );
  });

  it("Should have emission cap of 4361.4775 $nRyu at level 0 tier 3", async function () {
    expect(await stakingGen2.getEmissionCapPerLevelAndTier(0, 2)).to.equal(
      ethers.utils.parseEther("4361.4775")
    );
  });

  it("Should have emission cap of 7117.98075 $nRyu at level 50 tier 3", async function () {
    expect(await stakingGen2.getEmissionCapPerLevelAndTier(50, 2)).to.equal(
      ethers.utils.parseEther("7117.98075")
    );
  });

  it("Should have emission day of 2.255 $nRyu at level 0 tier 1", async function () {
    expect(await stakingGen2.getEmissionDayPerLevelAndTier(0, 0)).to.equal(
      ethers.utils.parseEther("0.6833")
    );
  });

  it("Should have emission day of 75.9 $nRyu at level 50 tier 1", async function () {
    expect(await stakingGen2.getEmissionDayPerLevelAndTier(50, 0)).to.equal(
      ethers.utils.parseEther("11.5")
    );
  });

  it("Should have emission day of 4.4375 $nRyu at level 0 tier 2", async function () {
    expect(await stakingGen2.getEmissionDayPerLevelAndTier(0, 1)).to.equal(
      ethers.utils.parseEther("2.1833")
    );
  });

  it("Should have emission day of 88.125 $nRyu at level 50 tier 2", async function () {
    expect(await stakingGen2.getEmissionDayPerLevelAndTier(50, 1)).to.equal(
      ethers.utils.parseEther("13")
    );
  });

  it("Should have emission day of 8.18125 $nRyu at level 0 tier 3", async function () {
    expect(await stakingGen2.getEmissionDayPerLevelAndTier(0, 2)).to.equal(
      ethers.utils.parseEther("3.6833")
    );
  });

  it("Should have emission day of 100.23775 $nRyu at level 50 tier 3", async function () {
    expect(await stakingGen2.getEmissionDayPerLevelAndTier(50, 2)).to.equal(
      ethers.utils.parseEther("14.5")
    );
  });
});
