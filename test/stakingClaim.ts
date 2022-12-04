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

describe("Staking : Claim", function () {
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

  it("should earn 0 $nRyu after one day without staking it", async function () {
    const claimable = await stakingGen2.getClaimable(gen2tokenUser1[0]);
    expect(claimable).to.equal(ethers.utils.parseEther("0"));
  });

  it("should earn 0.6833 $nRyu after one day of staking by claiming", async function () {
    const balanceBefore = await mockErc20.balanceOf(user1.address);
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await stakingGen2.connect(user1).claim([gen2tokenUser1[0]]);
    const balanceAfter = await mockErc20.balanceOf(user1.address);
    expect(balanceAfter.sub(balanceBefore)).to.eq(
      ethers.utils.parseEther("0.6833")
    );
  });

  it("should earn 0.6833 $nRyu after one day of staking by unstaking", async function () {
    const balanceBefore = await mockErc20.balanceOf(user1.address);
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await stakingGen2.connect(user1).unstake([gen2tokenUser1[0]]);
    const balanceAfter = await mockErc20.balanceOf(user1.address);
    expect(balanceAfter.sub(balanceBefore)).to.eq(
      ethers.utils.parseEther("0.6833")
    );
  });

  it("should earn max of 2.255 $nRyu after full level 1 staking", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    expect(await stakingGen2.getClaimable(gen2tokenUser1[0])).to.equal(
      ethers.utils.parseEther("2.255")
    );
  });

  it("should earn 0.205 after upgrade to lvl 1", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    const claimable = await stakingGen2.getClaimable(gen2tokenUser1[0]);
    expect(claimable).to.equal(ethers.utils.parseEther("0.205"));
  });

  it("Maximum claimable should be 1751,65575", async function () {
    const balanceBefore = await mockErc20.balanceOf(user1.address);
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    for (let i = 0; i < 152; i++) {
      await ethers.provider.send("evm_increaseTime", [20 * 24 * 60 * 60]);
      await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    }
    await ethers.provider.send("evm_increaseTime", [20 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).claim([gen2tokenUser1[0]]);
    const balanceAfter = await mockErc20.balanceOf(user1.address);
    expect(balanceAfter.sub(balanceBefore)).to.eq(
      ethers.utils.parseEther("1751.65575")
    );
  });

  it("Should claim 0 if all is already claimed", async function () {
    await stakingGen2.connect(user1).stake([gen2tokenUser1[0]]);
    for (let i = 0; i < 152; i++) {
      await ethers.provider.send("evm_increaseTime", [20 * 24 * 60 * 60]);
      await stakingGen2.connect(user1).upgrade(gen2tokenUser1[0], false);
    }
    await ethers.provider.send("evm_increaseTime", [20 * 24 * 60 * 60]);
    await stakingGen2.connect(user1).claim([gen2tokenUser1[0]]);
    await ethers.provider.send("evm_increaseTime", [20 * 24 * 60 * 60]);
    await expect(
      stakingGen2.connect(user1).claim([gen2tokenUser1[0]])
    ).to.be.revertedWith("Nothing to claim");
  });
});
