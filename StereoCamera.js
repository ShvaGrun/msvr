
// Constructor
class StereoCamera {
    constructor(
        Convergence,
        EyeSeparation,
        AspectRatio,
        FOV,
        NearClippingDistance,
        FarClippingDistance
    ) {
        this.mConvergence = Convergence;
        this.mEyeSeparation = EyeSeparation;
        this.mAspectRatio = AspectRatio;
        this.mFOV = FOV * Math.PI / 180.0;
        this.mNearClippingDistance = NearClippingDistance;
        this.mFarClippingDistance = FarClippingDistance;
    }
    ApplyLeftFrustum() {
        const top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        const bottom = -top;

        const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        const left = -b * this.mNearClippingDistance / this.mConvergence;
        const right = c * this.mNearClippingDistance / this.mConvergence;

        this.projection = m4.frustum(left, right, bottom, top,
            this.mNearClippingDistance, this.mFarClippingDistance);
        this.modelView = m4.translation(this.mEyeSeparation / 2, 0.0, 0.0);
    }
    ApplyRightFrustum() {
        const top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        const bottom = -top;

        const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;

        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        const left = -c * this.mNearClippingDistance / this.mConvergence;
        const right = b * this.mNearClippingDistance / this.mConvergence;

        this.projection = m4.frustum(left, right, bottom, top,
            this.mNearClippingDistance, this.mFarClippingDistance);
        this.modelView = m4.translation(-this.mEyeSeparation / 2, 0.0, 0.0);
    }
}
